import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import type { DashboardNamedCount } from "../api/client";

type GeoFeature = {
  type: "Feature";
  properties: {
    ADMIN?: string;
    NAME?: string;
    NAME_LONG?: string;
    ISO_A2?: string;
    ISO_A3?: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  bbox?: number[];
};

type GeoCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

type HitCountry = DashboardNamedCount & {
  lat: number;
  lng: number;
  iso?: string;
};

type Props = {
  countries: DashboardNamedCount[];
  height?: number;
};

const NAME_ALIASES: Record<string, string> = {
  "united states": "united states of america",
  usa: "united states of america",
  us: "united states of america",
  uk: "united kingdom",
  "great britain": "united kingdom",
  russia: "russia",
  "russian federation": "russia",
  "south korea": "south korea",
  "korea, republic of": "south korea",
  "north korea": "north korea",
  "korea, democratic people's republic of": "north korea",
  vietnam: "vietnam",
  "viet nam": "vietnam",
  syria: "syria",
  "syrian arab republic": "syria",
  iran: "iran",
  "iran (islamic republic of)": "iran",
  tanzania: "united republic of tanzania",
  bolivia: "bolivia",
  venezuela: "venezuela",
  "czech republic": "czechia",
  "ivory coast": "côte d'ivoire",
  "cote d'ivoire": "côte d'ivoire",
};

function normName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function featureNames(f: GeoFeature): string[] {
  const props = f.properties || {};
  return [props.ADMIN, props.NAME, props.NAME_LONG].filter(Boolean).map((n) => normName(String(n)));
}

function resolveKey(name: string) {
  const n = normName(name);
  return NAME_ALIASES[n] || n;
}

/** Approximate centroid from GeoJSON bbox or outer ring averages. */
function featureCentroid(f: GeoFeature): { lat: number; lng: number } | null {
  if (f.bbox && f.bbox.length >= 4) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox;
    return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  }
  const coords = f.geometry?.coordinates;
  if (!coords) return null;

  let ring: number[][] | null = null;
  if (f.geometry.type === "Polygon") {
    ring = (coords as number[][][])[0] ?? null;
  } else if (f.geometry.type === "MultiPolygon") {
    ring = (coords as number[][][][])[0]?.[0] ?? null;
  }
  if (!ring?.length) return null;

  let lat = 0;
  let lng = 0;
  for (const pt of ring) {
    lng += pt[0];
    lat += pt[1];
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

export function ThreatGlobe({ countries, height = 420 }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [width, setWidth] = useState(640);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [hover, setHover] = useState<GeoFeature | null>(null);
  const [selected, setSelected] = useState<HitCountry | null>(null);
  const [ready, setReady] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries.geojson")
      .then((r) => r.json())
      .then((geo: GeoCollection) => {
        if (cancelled) return;
        setFeatures((geo.features || []).filter((f) => f.properties?.ISO_A2 !== "AQ"));
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!globeReady) return;
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 110;
    controls.maxDistance = 520;
    const root = wrapRef.current;
    const pause = () => {
      controls.autoRotate = false;
    };
    root?.addEventListener("pointerdown", pause);
    const resume = window.setTimeout(() => {
      controls.autoRotate = true;
    }, 14000);
    return () => {
      window.clearTimeout(resume);
      root?.removeEventListener("pointerdown", pause);
    };
  }, [globeReady, width]);

  const hitByKey = useMemo(() => {
    const map = new Map<string, DashboardNamedCount>();
    for (const c of countries) {
      map.set(resolveKey(c.name), c);
    }
    return map;
  }, [countries]);

  const maxCount = useMemo(
    () => Math.max(1, ...countries.map((c) => c.count), 1),
    [countries],
  );

  const featureIndex = useMemo(() => {
    const byName = new Map<string, GeoFeature>();
    for (const f of features) {
      for (const n of featureNames(f)) {
        byName.set(resolveKey(n), f);
        byName.set(n, f);
      }
    }
    return byName;
  }, [features]);

  const hits = useMemo(() => {
    const out: HitCountry[] = [];
    for (const c of countries) {
      const f = featureIndex.get(resolveKey(c.name));
      if (!f) continue;
      const center = featureCentroid(f);
      if (!center) continue;
      out.push({
        ...c,
        lat: center.lat,
        lng: center.lng,
        iso: f.properties.ISO_A2,
      });
    }
    return out;
  }, [countries, featureIndex]);

  const getHit = useCallback(
    (feat: GeoFeature | null | undefined) => {
      if (!feat) return null;
      for (const n of featureNames(feat)) {
        const hit = hitByKey.get(resolveKey(n)) || hitByKey.get(n);
        if (hit) return hit;
      }
      return null;
    },
    [hitByKey],
  );

  const polygonCapColor = useCallback(
    (feat: object) => {
      const f = feat as GeoFeature;
      const hit = getHit(f);
      if (hover === f) return hit ? "rgba(37, 99, 235, 0.78)" : "rgba(100, 116, 139, 0.55)";
      if (hit) {
        const t = hit.count / maxCount;
        const a = 0.42 + t * 0.4;
        return `rgba(37, 99, 235, ${a.toFixed(2)})`;
      }
      return "rgba(148, 163, 184, 0.28)";
    },
    [getHit, hover, maxCount],
  );

  const polygonAltitude = useCallback(
    (feat: object) => {
      const f = feat as GeoFeature;
      const hit = getHit(f);
      if (hover === f) return hit ? 0.08 : 0.03;
      if (hit) return 0.025 + (hit.count / maxCount) * 0.06;
      return 0.006;
    },
    [getHit, hover, maxCount],
  );

  const onPolygonClick = useCallback(
    (polygon: object | null) => {
      const f = polygon as GeoFeature | null;
      if (!f) return;
      const hit = getHit(f);
      const center = featureCentroid(f);
      if (center) {
        globeRef.current?.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.35 }, 900);
      }
      const controls = globeRef.current?.controls();
      if (controls) controls.autoRotate = false;
      if (hit && center) {
        setSelected({ ...hit, lat: center.lat, lng: center.lng, iso: f.properties.ISO_A2 });
      } else {
        setSelected({
          id: f.properties.ISO_A3 || f.properties.ADMIN || "country",
          name: f.properties.ADMIN || f.properties.NAME || "Country",
          entityType: "Country",
          count: 0,
          lat: center?.lat ?? 0,
          lng: center?.lng ?? 0,
          iso: f.properties.ISO_A2,
        });
      }
    },
    [getHit],
  );

  const zoomBy = (delta: number) => {
    const pov = globeRef.current?.pointOfView();
    if (!pov) return;
    const next = Math.min(3.8, Math.max(0.45, (pov.altitude ?? 2) + delta));
    globeRef.current?.pointOfView({ ...pov, altitude: next }, 350);
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = false;
  };

  const resetView = () => {
    globeRef.current?.pointOfView({ lat: 18, lng: 20, altitude: 2.15 }, 800);
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = true;
    setSelected(null);
  };

  return (
    <div className="ti-globe" ref={wrapRef}>
      <div className="ti-globe-stage" style={{ height }}>
        {ready && (
          <Globe
            ref={globeRef}
            width={width}
            height={height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
            atmosphereColor="#93c5fd"
            atmosphereAltitude={0.16}
            showAtmosphere
            animateIn
            polygonsData={features}
            polygonGeoJsonGeometry="geometry"
            polygonCapColor={polygonCapColor}
            polygonSideColor={() => "rgba(37, 99, 235, 0.12)"}
            polygonStrokeColor={() => "rgba(15, 23, 42, 0.35)"}
            polygonAltitude={polygonAltitude}
            polygonsTransitionDuration={400}
            polygonLabel={(d: object) => {
              const f = d as GeoFeature;
              const hit = getHit(f);
              const name = f.properties.ADMIN || f.properties.NAME || "Country";
              if (hit) {
                return `<div class="ti-globe-tip"><strong>${name}</strong><span>${hit.count} relationship${hit.count === 1 ? "" : "s"}</span></div>`;
              }
              return `<div class="ti-globe-tip"><strong>${name}</strong><span>No targeted intel yet</span></div>`;
            }}
            onPolygonHover={(p) => setHover((p as GeoFeature) || null)}
            onPolygonClick={(p) => onPolygonClick(p)}
            pointsData={hits}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.02}
            pointRadius={(d) => 0.35 + ((d as HitCountry).count / maxCount) * 0.55}
            pointColor={() => "#1d4ed8"}
            pointLabel={(d) => {
              const h = d as HitCountry;
              return `<div class="ti-globe-tip"><strong>${h.name}</strong><span>${h.count} hits</span></div>`;
            }}
            labelsData={hits}
            labelLat="lat"
            labelLng="lng"
            labelText="name"
            labelSize={1.1}
            labelDotRadius={0.35}
            labelColor={() => "#0f172a"}
            labelAltitude={0.03}
            labelResolution={2}
            onGlobeReady={() => {
              setGlobeReady(true);
              globeRef.current?.pointOfView({ lat: 18, lng: 20, altitude: 2.15 }, 0);
            }}
          />
        )}
        {!ready && <p className="ti-empty">Loading globe…</p>}
      </div>

      <div className="ti-globe-toolbar">
        <button type="button" className="btn btn-ghost" onClick={() => zoomBy(-0.35)} title="Zoom in">
          Zoom in
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => zoomBy(0.45)} title="Zoom out">
          Zoom out
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetView}>
          Reset
        </button>
        <span className="ti-globe-hint">Drag to orbit · Scroll to zoom · Click a country</span>
      </div>

      <div className="ti-globe-footer">
        {selected ? (
          <div className="ti-globe-selection">
            <strong>{selected.name}</strong>
            <span>
              {selected.count > 0
                ? `${selected.count} targeted relationship${selected.count === 1 ? "" : "s"}`
                : "Visible on globe — highlight when intel lands"}
            </span>
          </div>
        ) : countries.length > 0 ? (
          <div className="ti-country-chips">
            {countries.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                className="badge ti-globe-chip"
                onClick={() => {
                  const hit = hits.find((h) => h.id === c.id);
                  if (hit) {
                    setSelected(hit);
                    globeRef.current?.pointOfView({ lat: hit.lat, lng: hit.lng, altitude: 1.2 }, 900);
                    const controls = globeRef.current?.controls();
                    if (controls) controls.autoRotate = false;
                  }
                }}
              >
                {c.name} · {c.count}
              </button>
            ))}
          </div>
        ) : (
          <p className="ti-globe-status">
            All countries loaded. Targeted regions will rise and glow when OpenCTI relationships arrive.
          </p>
        )}
      </div>
    </div>
  );
}
