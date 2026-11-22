import {
  resolveEntityType,
  type EntityCatalogDef,
  type EntityCatalogType,
  entityTypeToSlug,
} from "./catalog.js";
import { openctiGraphql, OpenCtiError } from "./client.js";
import {
  normalizeIndicator,
  normalizeThreatEntity,
  type ThreatActorLike,
  type ThreatIndicator,
} from "./normalize.js";

const CORE_FIELDS = `
  id
  standard_id
  entity_type
  created
  modified
  objectLabel { value color }
`;

/** Per-type selections — OpenCTI connection nodes are concrete types (no cross-fragments). */
const TYPE_FIELDS: Record<EntityCatalogType, string> = {
  "intrusion-sets": `name description aliases`,
  malwares: `name description aliases`,
  indicators: `name description pattern_type pattern valid_from valid_until confidence x_opencti_score`,
  "attack-patterns": `name description x_mitre_id aliases`,
  campaigns: `name description aliases`,
  tools: `name description aliases`,
  vulnerabilities: `name description`,
  reports: `name description published`,
};

/** For stixDomainObject(id) polymorphic lookup */
const DETAIL_FRAGMENTS = `
  ... on AttackPattern { name description x_mitre_id aliases }
  ... on IntrusionSet { name description aliases }
  ... on Malware { name description aliases }
  ... on Campaign { name description aliases }
  ... on Tool { name description aliases }
  ... on Vulnerability { name description }
  ... on Report { name description published }
  ... on Indicator {
    name description pattern_type pattern valid_from valid_until confidence x_opencti_score
  }
`;

export type CatalogEntity = ThreatActorLike & {
  patternType?: string;
  pattern?: string;
  confidence?: number | null;
  score?: number | null;
  mitreId?: string | null;
  slug: string;
};

function toCatalogEntity(node: Record<string, unknown>, def: EntityCatalogDef): CatalogEntity {
  if (def.type === "indicators") {
    const ind = normalizeIndicator(node);
    return {
      id: ind.id,
      entityType: def.entityType,
      name: ind.name,
      aliases: [],
      description: String(node.description ?? ""),
      createdAt: ind.createdAt,
      modifiedAt: ind.modifiedAt,
      labels: ind.labels,
      regions: [],
      countries: [],
      raw: ind.raw,
      patternType: ind.patternType,
      pattern: ind.pattern,
      confidence: ind.confidence,
      score: ind.score,
      slug: def.routeSlug,
    };
  }
  const base = normalizeThreatEntity(node, def.entityType);
  return {
    ...base,
    mitreId:
      typeof node.x_mitre_id === "string"
        ? node.x_mitre_id
        : extractMitreFromExternal(node),
    slug: def.routeSlug,
  };
}

function extractMitreFromExternal(node: Record<string, unknown>): string | null {
  const refs = node.externalReferences as
    | Array<{ external_id?: string; source_name?: string }>
    | { edges?: Array<{ node?: { external_id?: string; source_name?: string } }> }
    | undefined;
  const list = Array.isArray(refs)
    ? refs
    : (refs?.edges ?? []).map((e) => e.node).filter(Boolean);
  for (const r of list as Array<{ external_id?: string; source_name?: string }>) {
    const id = String(r?.external_id ?? "");
    if (/^T\d{4}/i.test(id)) return id.toUpperCase();
  }
  return null;
}

export async function listCatalogEntities(params: {
  type: string;
  first?: number;
  after?: string;
  search?: string;
}): Promise<{ entities: CatalogEntity[]; total: number; endCursor: string | null; catalog: EntityCatalogDef }> {
  const def = resolveEntityType(params.type);
  if (!def) throw new OpenCtiError(`Unknown entity type: ${params.type}`, 400);

  const first = Math.min(100, Math.max(1, params.first ?? 25));
  const field = def.graphqlField;

  const typeFields = TYPE_FIELDS[def.type];
  const data = await openctiGraphql<
    Record<
      string,
      {
        edges: Array<{ node: Record<string, unknown> }>;
        pageInfo: { globalCount?: number; endCursor?: string; hasNextPage?: boolean };
      }
    >
  >(
    `
    query CatalogList($first: Int, $after: ID, $search: String) {
      ${field}(
        first: $first
        after: $after
        orderBy: created
        orderMode: desc
        search: $search
      ) {
        edges {
          node {
            ${CORE_FIELDS}
            ${typeFields}
          }
        }
        pageInfo { globalCount endCursor hasNextPage }
      }
    }
  `,
    {
      first,
      after: params.after || null,
      search: params.search?.trim() || null,
    },
  ).catch(async () => {
    return openctiGraphql<
      Record<
        string,
        {
          edges: Array<{ node: Record<string, unknown> }>;
          pageInfo: { globalCount?: number; endCursor?: string };
        }
      >
    >(
      `
      query CatalogListBasic($first: Int, $after: ID) {
        ${field}(first: $first, after: $after, orderBy: created, orderMode: desc) {
          edges {
            node {
              ${CORE_FIELDS}
              ${typeFields}
            }
          }
          pageInfo { globalCount endCursor }
        }
      }
    `,
      { first, after: params.after || null },
    );
  });

  const conn = data[field];
  const entities = (conn?.edges ?? []).map((e) => toCatalogEntity(e.node, def));
  return {
    entities,
    total: Number(conn?.pageInfo?.globalCount ?? entities.length),
    endCursor: conn?.pageInfo?.endCursor ?? null,
    catalog: def,
  };
}

export async function getCatalogEntity(
  type: string,
  id: string,
): Promise<CatalogEntity> {
  const def = resolveEntityType(type);
  if (!def) throw new OpenCtiError(`Unknown entity type: ${type}`, 400);

  const data = await openctiGraphql<{
    stixDomainObject?: Record<string, unknown> | null;
  }>(
    `
    query CatalogOne($id: String!) {
      stixDomainObject(id: $id) {
        ${CORE_FIELDS}
        ${DETAIL_FRAGMENTS}
        externalReferences {
          edges { node { source_name external_id url } }
        }
      }
    }
  `,
    { id },
  ).catch(async () =>
    openctiGraphql<{ stixDomainObject?: Record<string, unknown> | null }>(
      `
      query CatalogOneBasic($id: String!) {
        stixDomainObject(id: $id) {
          ${CORE_FIELDS}
          ${DETAIL_FRAGMENTS}
        }
      }
    `,
      { id },
    ),
  );

  const node = data.stixDomainObject;
  if (!node) throw new OpenCtiError("Entity not found", 404);
  return toCatalogEntity(node, def);
}

export type RelNode = {
  id: string;
  name: string;
  entityType: string;
  slug: string;
};

export type RelEdge = {
  id: string;
  relationshipType: string;
  fromId: string;
  toId: string;
};

export async function getEntityRelationships(
  id: string,
  limit = 60,
): Promise<{ nodes: RelNode[]; edges: RelEdge[] }> {
  const data = await openctiGraphql<{
    stixCoreRelationships: {
      edges: Array<{
        node: {
          id: string;
          relationship_type?: string;
          from?: { id?: string; entity_type?: string; name?: string };
          to?: { id?: string; entity_type?: string; name?: string };
        };
      }>;
    };
  }>(
    `
    query EntityRels($ids: [String], $first: Int) {
      stixCoreRelationships(
        first: $first
        orderBy: created
        orderMode: desc
        fromOrToId: $ids
      ) {
        edges {
          node {
            id
            relationship_type
            from {
              ... on BasicObject { id entity_type }
              ... on AttackPattern { id name entity_type }
              ... on IntrusionSet { id name entity_type }
              ... on Malware { id name entity_type }
              ... on Campaign { id name entity_type }
              ... on Tool { id name entity_type }
              ... on Vulnerability { id name entity_type }
              ... on Report { id name entity_type }
              ... on Indicator { id name entity_type }
              ... on ThreatActorGroup { id name entity_type }
              ... on Organization { id name entity_type }
              ... on Sector { id name entity_type }
              ... on Country { id name entity_type }
            }
            to {
              ... on BasicObject { id entity_type }
              ... on AttackPattern { id name entity_type }
              ... on IntrusionSet { id name entity_type }
              ... on Malware { id name entity_type }
              ... on Campaign { id name entity_type }
              ... on Tool { id name entity_type }
              ... on Vulnerability { id name entity_type }
              ... on Report { id name entity_type }
              ... on Indicator { id name entity_type }
              ... on ThreatActorGroup { id name entity_type }
              ... on Organization { id name entity_type }
              ... on Sector { id name entity_type }
              ... on Country { id name entity_type }
            }
          }
        }
      }
    }
  `,
    { ids: [id], first: Math.min(100, Math.max(1, limit)) },
  );

  const nodeMap = new Map<string, RelNode>();
  const edges: RelEdge[] = [];

  const upsert = (n?: { id?: string; entity_type?: string; name?: string }) => {
    if (!n?.id) return;
    const entityType = String(n.entity_type ?? "Unknown");
    if (!nodeMap.has(n.id)) {
      nodeMap.set(n.id, {
        id: n.id,
        name: String(n.name ?? entityType),
        entityType,
        slug: entityTypeToSlug(entityType),
      });
    } else if (n.name && nodeMap.get(n.id)!.name === nodeMap.get(n.id)!.entityType) {
      nodeMap.get(n.id)!.name = String(n.name);
    }
  };

  for (const e of data.stixCoreRelationships?.edges ?? []) {
    const from = e.node.from;
    const to = e.node.to;
    upsert(from);
    upsert(to);
    if (from?.id && to?.id) {
      edges.push({
        id: e.node.id,
        relationshipType: String(e.node.relationship_type ?? "related-to"),
        fromId: from.id,
        toId: to.id,
      });
    }
  }

  return { nodes: [...nodeMap.values()], edges };
}

export async function listAttackPatternsForCoverage(limit = 400): Promise<
  Array<{ id: string; name: string; mitreId: string | null }>
> {
  const data = await openctiGraphql<{
    attackPatterns: {
      edges: Array<{
        node: {
          id: string;
          name?: string;
          x_mitre_id?: string;
          externalReferences?: {
            edges?: Array<{ node?: { external_id?: string; source_name?: string } }>;
          };
        };
      }>;
    };
  }>(
    `
    query AttackPatterns($first: Int) {
      attackPatterns(first: $first, orderBy: name, orderMode: asc) {
        edges {
          node {
            id
            name
            x_mitre_id
            externalReferences {
              edges { node { source_name external_id } }
            }
          }
        }
      }
    }
  `,
    { first: Math.min(500, Math.max(50, limit)) },
  ).catch(async () => {
    const basic = await openctiGraphql<{
      attackPatterns: { edges: Array<{ node: { id: string; name?: string; x_mitre_id?: string } }> };
    }>(
      `
      query AttackPatternsBasic($first: Int) {
        attackPatterns(first: $first, orderBy: created, orderMode: desc) {
          edges { node { id name x_mitre_id } }
        }
      }
    `,
      { first: limit },
    );
    return basic;
  });

  return (data.attackPatterns?.edges ?? []).map((e) => {
    const node = e.node as Record<string, unknown>;
    return {
      id: e.node.id,
      name: String(e.node.name ?? e.node.id),
      mitreId:
        typeof e.node.x_mitre_id === "string" && e.node.x_mitre_id
          ? e.node.x_mitre_id.toUpperCase()
          : extractMitreFromExternal(node),
    };
  });
}

export type { EntityCatalogType, ThreatIndicator };
