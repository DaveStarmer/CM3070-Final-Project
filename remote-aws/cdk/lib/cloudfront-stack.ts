import { CfnCustomResource, CfnOutput, CfnParameter, CustomResource, Duration, Fn, Stack, StackProps } from "aws-cdk-lib"
import { Certificate } from "aws-cdk-lib/aws-certificatemanager"
import { CfnCloudFrontOriginAccessIdentity, Distribution, LambdaEdgeEventType, OriginAccessIdentity, S3OriginAccessControl, experimental, Signing, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront"
import { HttpOrigin, S3BucketOrigin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins"
import { CfnUserPoolUser, LambdaVersion, UserPool, VerificationEmailStyle } from "aws-cdk-lib/aws-cognito"
import { CanonicalUserPrincipal, CompositePrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam"
import { Code, Function, IVersion, Runtime, Version } from "aws-cdk-lib/aws-lambda"
import { HostedZone } from "aws-cdk-lib/aws-route53"
import { Bucket, EventType, HttpMethods } from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"
import { Domain } from "domain"
import { UserPoolUser } from "./constructs/UserPoolUser"
// import { EdgeFunction } from "aws-cdk-lib/aws-cloudfront/lib/experimental"


export class CloudFrontStack extends Stack {
  publicWebBucket: Bucket
  privateWebBucket: Bucket
  certificate: any
  codeBucket: any
  authLambda: experimental.EdgeFunction
  authLambdaVersion: IVersion

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

    // User Email
    new CfnParameter(this, "userEmail", {
      type: "String",
      description: "Email of root user"
    })

    /** User Password */
    new CfnParameter(this, "userPassword", {
      type: "String",
      description: "Email of root user",
      default: "Pa55word!"
    })

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

    // create authorisation at edge lambda
    this.createEdgeLambda(props)
    // create CloudFront distro
    this.createCloudFrontDistro()
    // copy appropriate code to web buckets
    this.copyCodeToWebBuckets()
  }

  /** create CloudFront resources, and assign correct rights to buckets */
  oldcreateCloudFrontDistro() {
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

  }
  createCloudFrontDistro() {

    const originAccessControl = new S3OriginAccessControl(this, 'CameraOAC', {
      originAccessControlName: "Camera CF OAC",
      description: "Camera CloudFront Origin Access Control",
      signing: Signing.SIGV4_NO_OVERRIDE
    })

    const s3Origin = S3BucketOrigin.withOriginAccessControl(this.privateWebBucket, {
      originAccessControl,
      customHeaders: {
        DomainName: Fn.ref("domainName")
      }
    })


    /** CloudFront Distribution */
    const dfDist = new Distribution(this, "CloudFrontDistribution", {
      enabled: true,
      comment: "CF Distro",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: s3Origin,
        edgeLambdas: [{
          eventType: LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: this.authLambdaVersion,
        }],
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: [Fn.sub("www.${domainName}")],
      certificate: this.certificate,
      enableLogging: false,
    })

    dfDist.node.addDependency(this.authLambda)

    // output CloudFront Distribution name
    new CfnOutput(this, "CloudFront-Distribution-Name", { value: dfDist.distributionDomainName })

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

    // userPool.addDomain("PersonalDomain", {
    //   customDomain: {
    //     domainName: Fn.sub("www.${domainName}"),
    //     certificate: this.certificate
    //   }
    // })
  }

  /** Code to web buckets */
  copyCodeToWebBuckets() {
    const copyLambda = new Function(this, "copyBetweenBuckets", {
      timeout: Duration.minutes(15),
      runtime: Runtime.PYTHON_3_13,
      handler: "handler.handler_function",
      code: Code.fromBucketV2(this.codeBucket, "lambdas/copy-web-code.zip")
    })

    const grantToCodeBucket = this.codeBucket.grantRead(copyLambda)
    const grantToPublicBucket = this.publicWebBucket.grantPut(copyLambda)
    const grantToPrivateBucket = this.privateWebBucket.grantPut(copyLambda)

    const copyPublicWebResources = new CustomResource(this, "copyPublicWebResources", {
      serviceToken: copyLambda.functionArn,
      properties: {
        sourceBucket: this.codeBucket.bucketName,
        destinationBucket: this.publicWebBucket.bucketName,
        keys: ["public-web"]
      }
    })
    copyPublicWebResources.node.addDependency(grantToCodeBucket)
    copyPublicWebResources.node.addDependency(grantToPublicBucket)

    const copyPrivateWebResources = new CustomResource(this, "copyPrivateWebResources", {
      serviceToken: copyLambda.functionArn,
      properties: {
        sourceBucket: this.codeBucket.bucketName,
        destinationBucket: this.privateWebBucket.bucketName,
        keys: ["private-web"]
      }
    })
    copyPrivateWebResources.node.addDependency(grantToCodeBucket)
    copyPrivateWebResources.node.addDependency(grantToPrivateBucket)
  }

  /** Deploy Edge Lambda */
  createEdgeLambda(props?: StackProps) {
    const lambdaRole = this.createEdgeLambdaRole()

    this.authLambda = new experimental.EdgeFunction(this, "edgeAuthLambda", {
      ...props,
      functionName: "edge-auth-lambda",
      runtime: Runtime.PYTHON_3_13,
      code: Code.fromBucketV2(this.codeBucket, "lambdas/auth-edge.zip"),
      timeout: Duration.seconds(5),
      handler: "handler.handler_function",
      role: lambdaRole,
    })

    this.authLambdaVersion = this.authLambda.currentVersion
  }

  createEdgeLambdaRole() {
    // const ssmGetParameterPolicy = new ManagedPolicy(
    //   this,
    //   "ssm-get-parameter-policy",
    //   {
    //     managedPolicyName: `ssm-get-parameter-policy`,
    //     statements: [
    //       new PolicyStatement({
    //         effect: Effect.ALLOW,
    //         actions: [
    //           "ssm:GetParameter"
    //         ],
    //         resources: [
    //           "*"
    //         ]
    //       })
    //     ]
    //   }
    // )

    const cloudWatchLogsPolicy = new ManagedPolicy(
      this,
      "cloudwatchLogsPolicy",
      {
        managedPolicyName: `cloudwatch-logs-policy`,
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

    // const secretsManagerPolicy = new ManagedPolicy(
    //   this,
    //   "secrets-manager-policy",
    //   {
    //     managedPolicyName: `secrets-manager-policy`,
    //     statements: [
    //       new PolicyStatement({
    //         effect: Effect.ALLOW,
    //         actions: [
    //           "secretsmanager:GetSecretValue",
    //         ],
    //         resources: ["*"
    //           // `arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:${props.envName}/${props.appName}*`
    //         ]
    //       })
    //     ]
    //   }
    // )

    const edgeLambdaRole = new Role(
      this,
      "edgeAuthLambdaRole",
      {
        roleName: `edge-auth-role`,
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("lambda.amazonaws.com"),
          new ServicePrincipal("edgelambda.amazonaws.com")
        ),
        managedPolicies: [
          cloudWatchLogsPolicy,
          // ssmGetParameterPolicy,
          // secretsManagerPolicy
        ],
      }
    )

    return edgeLambdaRole
  }
}
