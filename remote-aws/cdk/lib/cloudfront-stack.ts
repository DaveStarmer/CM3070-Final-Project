import { CfnCustomResource, CfnParameter, CustomResource, Duration, Fn, Stack, StackProps } from "aws-cdk-lib"
import { Certificate } from "aws-cdk-lib/aws-certificatemanager"
import { CfnCloudFrontOriginAccessIdentity, Distribution } from "aws-cdk-lib/aws-cloudfront"
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins"
import { UserPool, VerificationEmailStyle } from "aws-cdk-lib/aws-cognito"
import { CanonicalUserPrincipal } from "aws-cdk-lib/aws-iam"
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda"
import { HostedZone } from "aws-cdk-lib/aws-route53"
import { Bucket, HttpMethods } from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"
import { Domain } from "domain"


export class CloudFrontStack extends Stack {
  publicWebBucket: Bucket
  privateWebBucket: Bucket
  certificate: any
  codeBucket: any
  authLambda: Function

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // elements passed in as parameters
    /** CloudFormation Parameter for Unique ID to add to resource names where necessary */
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    }).toString()

    // name of code bucket
    new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Code bucket name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$",
      default: "instruct-code-2560df37ccbefd6b43eeb50fdc8abe7f"
    })

    // location of code bucket
    new CfnParameter(this, "codeBucketRegion", {
      type: "String",
      description: "Code Bucket Region",
      allowedPattern: "^[a-z0-9-]{1,12}$",
      default: props?.env?.region
    })

    /** code bucket construct */
    // this.codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref("codeBucketName"))
    this.codeBucket = Bucket.fromBucketAttributes(this, "codeBucket", {
      bucketName: Fn.ref("codeBucketName"),
      region: Fn.ref("codeBucketRegion")
    })

    /** Registered Domain Name */
    const domainName = new CfnParameter(this, "domainName", {
      type: "String",
      description: "Registered Domain Name",
      // pattern taken from https://stackoverflow.com/a/3809435
      allowedPattern: "[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)"
    })

    /** Parameter for Certificate ARN */
    const certificateArn = new CfnParameter(this, "certificateArn", {
      type: "String",
      description: "ARN of certificate",
      allowedPattern: "^[a-z0-9\\.\\/\\:-]{1,2048}$"
    })

    /** Certificate */
    this.certificate = Certificate.fromCertificateArn(this, "dashboardCertificate", Fn.ref("certificateArn"))

    // Create Resources

    /** bucket for private web content - dashboard */
    this.privateWebBucket = new Bucket(this, "privateWebBucket", {
      bucketName: Fn.sub("vid-dash-private-web-${uniqueId}")
    })

    /** bucket for public web content */
    this.publicWebBucket = new Bucket(this, "publicWebBucket", {
      bucketName: Fn.sub("vid-dash-public-web-${uniqueId}"),
      cors: [{
        allowedOrigins: ["http*"],
        allowedMethods: [HttpMethods.GET],
        allowedHeaders: ["*"],
        exposedHeaders: ["Etag", "x-amx-meta-custom-header"]
      }]
    })

    this.createCloudFrontDistro()

    this.copyCodeToWebBuckets()
  }

  /** create CloudFront resources, and assign correct rights to buckets */
  createCloudFrontDistro() {
    /** CloudFront User */
    const cloudFrontOAI = new CfnCloudFrontOriginAccessIdentity(this, "cloudFrontOAI", {
      cloudFrontOriginAccessIdentityConfig: { comment: "CloudFrontOAI" }
    })

    /** user principal for cloud front */
    const cfUserPrincipal = new CanonicalUserPrincipal(cloudFrontOAI.attrS3CanonicalUserId)


    // grant read rights to CloudFront User
    this.publicWebBucket.grantRead(cfUserPrincipal)

    // grant read rights to CloudFront User
    this.privateWebBucket.grantRead(cfUserPrincipal)

    /** CloudFront Distribution */
    const dfDist = new Distribution(this, "CloudFrontDistribution", {
      enabled: true,
      comment: "CF Distro",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withBucketDefaults(this.publicWebBucket),
      },
      domainNames: [Fn.sub("www.${domainName}")],
      certificate: this.certificate
    })

    const userPool = new UserPool(this, "userPool", {
      userPoolName: "vid-user-pool",
      signInAliases: {
        email: true
      },
      selfSignUpEnabled: false,
      autoVerify: {
        email: true,
        // in a production system, phone would also be required verification
        // phone: true
      },
      userVerification: {
        emailSubject: "Verify your email for your new Private Camera System",
        emailBody: "Hello {username}. Your account has been created. Your verification code is {####}",
        emailStyle: VerificationEmailStyle.CODE,
      },
      userInvitation: {
        emailSubject: "Invite to Surveillance System",
        emailBody: "Hello {username}. You have been invited to join the Surveillance System. Your temporary password is {####}"
      }
    })
  }

  /** Code to web buckets */
  copyCodeToWebBuckets() {
    // const copyLambda = new Function(this, "copyWebPages", {
    //   timeout: Duration.minutes(15),
    //   runtime: Runtime.PYTHON_3_13,
    //   handler: "index.handler_function",
    //   // code is present in lambdas/copy-web-code/handler.py with additional annotation, which is 
    //   // not present here due to size limits
    //   // code: Code.fromBucketV2(this.codeBucket,)
    // })
    const copyLambda = new Function(this, "copyWebPages", {
      timeout: Duration.minutes(15),
      runtime: Runtime.PYTHON_3_13,
      handler: "handler.handler_function",
      code: Code.fromBucketV2(this.codeBucket, "lambdas/copy-web-code.zip")
    })

    const grantToCodeBucket = this.codeBucket.grantRead(copyLambda)
    const grantToPublicBucket = this.publicWebBucket.grantPut(copyLambda)
    const grantToPrivateBucket = this.privateWebBucket.grantPut(copyLambda)

    const copyResource = new CustomResource(this, "copyWebCode", {
      serviceToken: copyLambda.functionArn,
      properties: {
        sourceBucket: this.codeBucket.bucketName,
        sourceRegion: this.codeBucket.env.region,
        destinationBucket: this.publicWebBucket.bucketName,
        destinationRegion: this.publicWebBucket.env.region,
      }
    })
    copyResource.node.addDependency(grantToCodeBucket)
    copyResource.node.addDependency(grantToPrivateBucket)
    copyResource.node.addDependency(grantToPublicBucket)
  }

  /** Deploy Edge Lambdas */
  createEdgeLambda(props: StackProps) {
    this.authLambda = new Function(this, "edgeAuthLambda", {
      ...props,
      runtime: Runtime.PYTHON_3_13,
      code: Code.fromBucketV2(this.codeBucket, "auth-lambda.zip"),
      handler: "handler.handler_function",
      environment: {
        "DOMAIN": Fn.ref("domainName")
      }
    })
  }
}
