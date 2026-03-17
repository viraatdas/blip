import { notFound } from "next/navigation";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { getUser } from "../../../../lib/get-user";
import AgentDetailClient from "./agent-detail-client";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AgentDetailPage({ params }: Props) {
  const user = await getUser();

  const { id } = await params;
  const agent = await agentRepo.findById(id, user.id);
  if (!agent) notFound();

  // Strip the encrypted API key before passing to client
  const { anthropic_api_key, ...agentData } = agent;

  return (
    <AgentDetailClient
      agent={{ ...agentData, has_anthropic_key: !!anthropic_api_key }}
    />
  );
}
