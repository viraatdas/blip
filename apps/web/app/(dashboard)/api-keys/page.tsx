import * as apiKeyRepo from "@blip/db/repositories/api-key-repository";
import { getUser } from "../../../lib/get-user";
import ApiKeysClient from "./api-keys-client";

export default async function ApiKeysPage() {
  const user = await getUser();

  const keys = await apiKeyRepo.findAllByUser(user.id);

  return <ApiKeysClient initialKeys={keys} />;
}
