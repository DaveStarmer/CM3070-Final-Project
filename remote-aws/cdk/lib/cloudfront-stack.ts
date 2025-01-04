import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { CfnCloudFrontOriginAccessIdentity, Distribution } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CanonicalUserPrincipal } from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { Domain } from "domain";


export class CloudFrontStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    /** Verify correct region for CloudFront deployment */
    const correctRegion = Fn.conditionEquals(Fn.ref("AWS::Region"), "us-east-1")

    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    })

    /** CloudFront User */
    const cloudFrontOAI = new CfnCloudFrontOriginAccessIdentity(this, "cloudFrontOAI", {
      cloudFrontOriginAccessIdentityConfig: { comment: "CloudFrontOAI" }
    })

    /** user principal for cloud front */
    const cfUserPrincipal = new CanonicalUserPrincipal(cloudFrontOAI.attrS3CanonicalUserId)

    /** name of private code bucket */
    const codeBucketName = new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Private Code Bucket Name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$"
    })

    /** private code bucket construct */
    const codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref(codeBucketName.toString()))

    /** bucket for public web content */
    const publicWebBucket = new Bucket(this, "publicWebBucket", {
      bucketName: Fn.sub("vid-dash-public-web-${uniqueId}"),
      cors: [{
        allowedOrigins: ["http*"],
        allowedMethods: [HttpMethods.GET],
        allowedHeaders: ["*"],
        exposedHeaders: ["Etag", "x-amx-meta-custom-header"]
      }]
    })
    // grant read rights to CloudFront User
    publicWebBucket.grantRead(cfUserPrincipal)

    /** bucket for private web content - dashboard */
    const privateWebBucket = new Bucket(this, "privateWebBucket", {
      bucketName: Fn.sub("vid-dash-private-web-${uniqueId}")
    })
    // grant read rights to CloudFront User
    privateWebBucket.grantRead(cfUserPrincipal)

    /** CloudFront Distribution */
    const dfDist = new Distribution(this, "CloudFrontDistribution", {
      enabled: true,
      comment: "CF Distro",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withBucketDefaults(privateWebBucket)
      }
    })

    const domain = new Domain()
  }
}