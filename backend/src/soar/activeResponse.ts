import { wazuhApiPut } from "../wazuh/api.js";

export type ActiveResponseRequest = {
  command: string;
  agentId?: string | null;
  arguments?: string[];
  dryRun: boolean;
};

export async function runActiveResponse(input: ActiveResponseRequest) {
  const args = (input.arguments ?? []).filter(Boolean);
  const payload = {
    command: input.command,
    arguments: args,
    alert: {
      data: {
        srcip: args[0] ?? undefined,
      },
    },
  };

  if (input.dryRun) {
    return {
      dryRun: true as const,
      wouldCall: {
        method: "PUT",
        path: input.agentId
          ? `/active-response?agents_list=${encodeURIComponent(input.agentId)}`
          : "/active-response",
        body: payload,
      },
      message: `Dry run: would execute ${input.command}${input.agentId ? ` on agent ${input.agentId}` : ""}${
        args.length ? ` args=[${args.join(", ")}]` : ""
      }.`,
    };
  }

  const path = input.agentId
    ? `/active-response?agents_list=${encodeURIComponent(input.agentId)}`
    : "/active-response";

  const data = await wazuhApiPut<unknown>(path, payload);
  return {
    dryRun: false as const,
    response: data,
    message: `Executed ${input.command}${input.agentId ? ` on agent ${input.agentId}` : ""}.`,
  };
}
