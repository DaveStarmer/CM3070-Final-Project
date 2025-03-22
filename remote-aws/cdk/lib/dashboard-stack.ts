import { CfnParameter, Duration, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { ApplicationLogLevel, Code, Function, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket, EventType, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CompositePrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ParameterDataType, ParameterTier, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';


export class DashboardStack extends Stack {
  /** private code bucket construct */
  codeBucket: IBucket
  /** video clip arrivals bucket */
  uploadBucket: IBucket
  /** video clip storage bucket */
  videoBucket: IBucket
  /** DynamoDB Table for all activations */
  database: TableV2
  /** lambda to deal with notifications */
  notificationLambda: Function
  /** centralised policy list */
  policies: { [key: string]: ManagedPolicy }

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // get CloudFormation parameters
    new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    });

    // name of private code bucket
    new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Private Code Bucket Name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$",
      default: "instruct-code-2560df37ccbefd6b43eeb50fdc8abe7f"
    })

    // Buckets
    // create bucket CDK construct from name
    this.codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref("codeBucketName"))

    // create bucket to upload clips into
    this.uploadBucket = new Bucket(this, "videoUpload", {
      bucketName: Fn.sub("vid-dash-upload-${uniqueId}")
    })

    // create bucket to store clips in
    this.videoBucket = new Bucket(this, "videoStorage", {
      bucketName: Fn.sub("vid-dash-video-${uniqueId}")
    })

    new StringParameter(this, "cognitoEndpointParam", {
      description: "Cognito Endpoint",
      dataType: ParameterDataType.TEXT,
      tier: ParameterTier.STANDARD,
      parameterName: "camera-system-state",
      stringValue: "ENABLED"
    })

    // create centralised managed policies which are used by individual roles
    this.policies = {} // typescript compiler requires a value, properly filled by the function call
    this.createManagedPolicies()

    // create database table to store notifications
    this.createDynamoDBTable()

    // create lambda to respond to uploads and notify users
    this.createNotificationLambda()
    // link this lambda to creation of an object in the upload bucket
    this.uploadBucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(this.notificationLambda))

    // create API for listing notifications
    this.createListApi()
  }

  createDynamoDBTable() {
    this.database = new TableV2(this, "activationTable", {
      tableName: "activations",
      partitionKey: { name: "camera", type: AttributeType.STRING },
      sortKey: { name: "timestamp", type: AttributeType.STRING },
      localSecondaryIndexes: [{
        indexName: "clipStatusIndex",
        sortKey: { name: "clipStatus", "type": AttributeType.STRING }
      }],
      billing: Billing.onDemand()
    })
  }

  createNotificationLambda() {
    /** name of latest version of lambda code */
    const lambdaKey = this.node.tryGetContext("lambdas")["notification"]

    /** lambda triggered by video upload */
    this.notificationLambda = new Function(this, "notificiationLambda", {
      functionName: "notification-lambda",
      description: "copies clips to storage bucket, writes info to database",
      timeout: Duration.minutes(5),
      runtime: Runtime.PYTHON_3_13,
      // source code for lambda
      code: Code.fromBucketV2(this.codeBucket, `lambdas/${lambdaKey}`),
      // name of function to invoke
      handler: "handler.handler_function",
      // environment variables for lambda - pass names of database table and buckets in
      environment: {
        "DYNAMODB_TABLE": this.database.tableName,
        "SOURCE_BUCKET": this.uploadBucket.bucketName,
        "DESTINATION_BUCKET": this.videoBucket.bucketName
      },
      role: this.createNotificationLambdaExecutionRole(),
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: ApplicationLogLevel.DEBUG
    })

    // add access rights for lambda to read and delete from upload bucket
    this.uploadBucket.grantRead(this.notificationLambda)
    this.uploadBucket.grantDelete(this.notificationLambda)
    // add access rights for lambda to write to video storage bucket
    this.videoBucket.grantPut(this.notificationLambda)
    // add access rights for lambda to write to dynamodb table
    this.database.grantWriteData(this.notificationLambda)
  }

  createNotificationLambdaExecutionRole() {
    const lambdaRole = new Role(
      this,
      "notificationLambdaRole",
      {
        roleName: "notification-lambda-role",
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("lambda.amazonaws.com"),
          new ServicePrincipal("edgelambda.amazonaws.com")
        ),
        managedPolicies: [
          this.policies["cloudWatch"],
          this.policies["getParameter"]
        ],
      }
    )

    return lambdaRole
  }

  createListApi() {
    const api = new LambdaRestApi(this, "listActivationsApi", {
      description: "list activations",
      handler: this.createListApiLambda(),
      proxy: false
    })

    const listActivations = api.root.addResource("activations")
    listActivations.addMethod("GET")
  }

  createListApiLambda() {
    /** name of latest version of lambda code */
    const lambdaKey = this.node.tryGetContext("lambdas")["list-api"]

    /** lambda to deal with api requests to list activations */
    const listApiLambda = new Function(this, "listApiLambda", {
      functionName: "list-api-lambda",
      description: "responds to api requests for lists of notification",
      timeout: Duration.minutes(5),
      runtime: Runtime.PYTHON_3_13,
      // source code for lambda
      code: Code.fromBucketV2(this.codeBucket, `lambdas/${lambdaKey}`),
      // name of function to invoke
      handler: "handler.handler_function",
      // environment variables for lambda - pass names of database table and buckets in
      environment: {
        "DYNAMODB_TABLE": this.database.tableName
      },
      role: this.createListAPILambdaExecutionRole(),
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: ApplicationLogLevel.DEBUG
    })

    // add access rights for lambda to read from database
    this.database.grantReadData(listApiLambda)

    return listApiLambda
  }

  createListAPILambdaExecutionRole() {
    const lambdaRole = new Role(
      this,
      "notificationLambdaRole",
      {
        roleName: "notification-lambda-role",
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("lambda.amazonaws.com"),
          new ServicePrincipal("edgelambda.amazonaws.com")
        ),
        managedPolicies: [
          this.policies["cloudWatch"]
        ],
      }
    )

    return lambdaRole
  }

  createManagedPolicies() {
    this.policies["cloudWatch"] = new ManagedPolicy(
      this,
      "cloudWatchLogsPolicy",
      {
        managedPolicyName: "cam-logs-policy",
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents"
            ],
            resources: [
              `arn:${this.partition}:logs:*:*:*`
            ]
          })
        ]
      }
    )

    this.policies["getParameter"] = new ManagedPolicy(
      this,
      "ssmGetParameterPolicy",
      {
        managedPolicyName: "cam-get-parameter-policy",
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              "ssm:GetParameter",
              "ssm:GetParameters"
            ],
            resources: [
              `arn:${this.partition}:ssm:*:*:*`
            ]
          })
        ]
      }
    )
  }

}
