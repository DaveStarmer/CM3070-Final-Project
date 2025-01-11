import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
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

    // elements passed in as parameters
    /** CloudFormation Parameter for Unique ID to add to resource names where necessary */
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    }).toString()

    /** name of code bucket */
    const codeBucketName = new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Code bucket name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$",
      default: "instruct-code-2560df37ccbefd6b43eeb50fdc8abe7f"
    }).toString()

    /** code bucket construct */
    const codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref(codeBucketName))

    /** Registered Domain Name */
    const domainName = new CfnParameter(this, "domainName", {
      type: "String",
      description: "Registered Domain Name",
      // pattern taken from https://stackoverflow.com/a/3809435
      allowedPattern: "[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"
    }).toString()

    /** Parameter for Certificate ARN */
    const certificateArn = new CfnParameter(this, "certificateArn", {
      type: "String",
      description: "ARN of certificate",
      allowedPattern: "^[a-z0-9\\.\\/\\:-]{1,2048}$"
    }).toString()

    /** Certificate */
    const certificate = Certificate.fromCertificateArn(this, "dashboardCertificate", certificateArn)

    // Create Resources
    /** CloudFront User */
    const cloudFrontOAI = new CfnCloudFrontOriginAccessIdentity(this, "cloudFrontOAI", {
      cloudFrontOriginAccessIdentityConfig: { comment: "CloudFrontOAI" }
    })

    /** user principal for cloud front */
    const cfUserPrincipal = new CanonicalUserPrincipal(cloudFrontOAI.attrS3CanonicalUserId)

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
        origin: S3BucketOrigin.withBucketDefaults(publicWebBucket),
      },
      domainNames: [domainName.toString()],
      certificate: certificate,
    })

    const domain = new Domain()
  }
}
