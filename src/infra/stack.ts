import path from "node:path";
import { Duration, CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

type BlipStackProps = StackProps & {
  flyAppName: string;
  flyMachineImage: string;
};

export class BlipStack extends Stack {
  public constructor(scope: Construct, id: string, props: BlipStackProps) {
    super(scope, id, props);

    const apiKeysTable = new dynamodb.Table(this, "ApiKeysTable", {
      partitionKey: { name: "keyId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });
    apiKeysTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING }
    });

    const sessionsTable = new dynamodb.Table(this, "SessionsTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });
    sessionsTable.addGlobalSecondaryIndex({
      indexName: "userId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING }
    });

    const usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: "stripeCustomerId-index",
      partitionKey: { name: "stripeCustomerId", type: dynamodb.AttributeType.STRING }
    });

    const flyApiTokenSecret = new secretsmanager.Secret(this, "FlyApiTokenSecret", {
      description: "Replace this value with a Fly API token that can create and destroy Machines."
    });
    const runnerSharedSecret = new secretsmanager.Secret(this, "RunnerSharedSecret");
    const sessionTokenSecret = new secretsmanager.Secret(this, "SessionTokenSecret");
    const clerkSecretKeySecret = new secretsmanager.Secret(this, "ClerkSecretKeySecret", {
      description: "Replace this value with your Clerk secret key (sk_live_... or sk_test_...)."
    });
    const stripeSecretKeySecret = new secretsmanager.Secret(this, "StripeSecretKeySecret", {
      description: "Replace this value with your Stripe secret key (sk_live_... or sk_test_...)."
    });
    const stripeWebhookSecret = new secretsmanager.Secret(this, "StripeWebhookSecret", {
      description: "Replace this value with your Stripe webhook signing secret (whsec_...)."
    });

    const sharedEnvironment = {
      API_KEYS_TABLE_NAME: apiKeysTable.tableName,
      SESSIONS_TABLE_NAME: sessionsTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      FLY_APP_NAME: props.flyAppName,
      FLY_APP_BASE_URL: `https://${props.flyAppName}.fly.dev`,
      FLY_MACHINE_IMAGE: props.flyMachineImage,
      FLY_API_TOKEN_SECRET_ID: flyApiTokenSecret.secretArn,
      RUNNER_SHARED_SECRET_ID: runnerSharedSecret.secretArn,
      SESSION_TOKEN_SECRET_ID: sessionTokenSecret.secretArn,
      CLERK_SECRET_KEY_SECRET_ID: clerkSecretKeySecret.secretArn,
      STRIPE_SECRET_KEY_SECRET_ID: stripeSecretKeySecret.secretArn,
      STRIPE_WEBHOOK_SECRET_ID: stripeWebhookSecret.secretArn,
      STRIPE_STARTER_PRICE_ID: "",
      STRIPE_PRO_PRICE_ID: ""
    };

    const apiFunction = new nodejs.NodejsFunction(this, "ApiFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(process.cwd(), "src/lambdas/api.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      memorySize: 1024,
      bundling: {
        target: "node20",
        minify: false
      },
      environment: sharedEnvironment
    });

    const cleanupFunction = new nodejs.NodejsFunction(this, "CleanupFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(process.cwd(), "src/lambdas/cleanup.ts"),
      handler: "handler",
      timeout: Duration.seconds(30),
      memorySize: 512,
      bundling: {
        target: "node20",
        minify: false
      },
      environment: sharedEnvironment
    });

    apiKeysTable.grantReadWriteData(apiFunction);
    sessionsTable.grantReadWriteData(apiFunction);
    sessionsTable.grantReadWriteData(cleanupFunction);
    usersTable.grantReadWriteData(apiFunction);
    flyApiTokenSecret.grantRead(apiFunction);
    runnerSharedSecret.grantRead(apiFunction);
    sessionTokenSecret.grantRead(apiFunction);
    clerkSecretKeySecret.grantRead(apiFunction);
    stripeSecretKeySecret.grantRead(apiFunction);
    stripeWebhookSecret.grantRead(apiFunction);
    flyApiTokenSecret.grantRead(cleanupFunction);
    runnerSharedSecret.grantRead(cleanupFunction);
    sessionTokenSecret.grantRead(cleanupFunction);

    const httpApi = new apigateway.HttpApi(this, "HttpApi", {
      apiName: "blip-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["authorization", "content-type", "x-api-key", "stripe-signature"],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS
        ]
      }
    });
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration("ApiIntegration", apiFunction)
    });
    httpApi.addRoutes({
      path: "/",
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration("ApiRootIntegration", apiFunction)
    });

    new events.Rule(this, "CleanupRule", {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new targets.LambdaFunction(cleanupFunction)]
    });

    new CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint
    });
    new CfnOutput(this, "FlyApiTokenSecretArn", {
      value: flyApiTokenSecret.secretArn
    });
    new CfnOutput(this, "RunnerSharedSecretArn", {
      value: runnerSharedSecret.secretArn
    });
    new CfnOutput(this, "SessionTokenSecretArn", {
      value: sessionTokenSecret.secretArn
    });
    new CfnOutput(this, "ClerkSecretKeySecretArn", {
      value: clerkSecretKeySecret.secretArn
    });
    new CfnOutput(this, "StripeSecretKeySecretArn", {
      value: stripeSecretKeySecret.secretArn
    });
    new CfnOutput(this, "StripeWebhookSecretArn", {
      value: stripeWebhookSecret.secretArn
    });
  }
}
