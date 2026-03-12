#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { BlipStack } from "./stack.js";

const app = new App();

const flyAppName = (app.node.tryGetContext("flyAppName") as string | undefined) ?? "blip-runner";
const flyMachineImage =
  (app.node.tryGetContext("flyMachineImage") as string | undefined) ??
  `registry.fly.io/${flyAppName}:latest`;

new BlipStack(app, "BlipStack", {
  flyAppName,
  flyMachineImage
});
