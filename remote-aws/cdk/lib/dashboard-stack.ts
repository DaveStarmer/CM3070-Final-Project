import { CfnParameter, Duration, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DashboardStack extends Stack {
  codeBucket: IBucket
  uploadBucket: IBucket
  videoBucket: IBucket
  database: TableV2

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // get CloudFormation parameters
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    });

    /** name of private code bucket */
    const codeBucketName = new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Private Code Bucket Name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$",
      default: "instruct-code-2560df37ccbefd6b43eeb50fdc8abe7f"
    })

    /** private code bucket construct */
    this.codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref("codeBucketName"))

    // Buckets
    /** video clip arrivals bucket */
    // this.uploadBucket = new Bucket(this, "videoUpload", {
    //   bucketName: Fn.sub("vid-dash-upload-${uniqueId}")
    // })

    // /** video clip storage bucket */
    // this.videoBucket = new Bucket(this, "videoStorage", {
    //   bucketName: Fn.sub("vid-dash-video-${uniqueId}")
    // })

    this.createDynamoDBTable()
    this.createNotificationLambda()
  }

  createDynamoDBTable() {
    /** DynamoDB Table for all activations */
    this.database = new TableV2(this, "activationsTable", {
      tableName: "activationsTable",
      partitionKey: { name: "filename", type: AttributeType.STRING },
      billing: Billing.onDemand()
    })
  }

  createNotificationLambda() {
    /** name of latest version of lambda code */
    const lambdaKey = this.node.tryGetContext("lambdas")["notification"]

    /** lambda triggered by video upload */
    const notificationLambda = new Function(this, "copyBetweenBuckets", {
      timeout: Duration.minutes(5),
      runtime: Runtime.PYTHON_3_13,
      // source code for lambda
      code: Code.fromBucketV2(this.codeBucket, `lambdas/${lambdaKey}`),
      // name of function to invoke
      handler: "handler.handler_function",
      // environment variables for lambda
      environment: {
        "DYNAMODB_TABLE": this.database.tableName,
        // "SOURCE_BUCKET": this.uploadBucket.bucketName,
        // "DESTINATION_BUCKET": this.videoBucket.bucketName
      }
    })

    // add access rights for lambda to read and delete from upload bucket
    // this.uploadBucket.grantRead(notificationLambda)
    // this.uploadBucket.grantDelete(notificationLambda)
    // add access rights for lambda to write to video storage bucket
    // this.videoBucket.grantPut(notificationLambda)
    // add access rights for lambda to write to dynamodb table
    this.database.grantWriteData(notificationLambda)
  }
}
