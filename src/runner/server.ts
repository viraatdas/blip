import { createServer } from "node:http";
import { createRunnerApp } from "./app.js";

const port = Number(process.env.PORT ?? "8080");

const app = await createRunnerApp();
const server = createServer(app);

server.listen(port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Fly runner listening.",
      port
    })
  );
});
