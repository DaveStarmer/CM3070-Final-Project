import { CfnCustomResource, CfnOutput, CfnParameter, CustomResource, Duration, Fn, RemovalPolicy, SecretValue, Stack, StackProps } from "aws-cdk-lib"
import { Certificate } from "aws-cdk-lib/aws-certificatemanager"
import { CfnCloudFrontOriginAccessIdentity, Distribution, LambdaEdgeEventType, OriginAccessIdentity, S3OriginAccessControl, experimental, Signing, ViewerProtocolPolicy, CachePolicy } from "aws-cdk-lib/aws-cloudfront"
import { HttpOrigin, S3BucketOrigin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins"
import { CfnUserPoolUser, LambdaVersion, UserPool, UserPoolClient, UserPoolDomain, VerificationEmailStyle } from "aws-cdk-lib/aws-cognito"
import { CanonicalUserPrincipal, CompositePrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal, User } from "aws-cdk-lib/aws-iam"
import { Code, Function, IVersion, Runtime, Version } from "aws-cdk-lib/aws-lambda"
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53"
import { Bucket, EventType, HttpMethods } from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"
import { Domain } from "domain"
import { UserPoolUser } from "./constructs/UserPoolUser"
import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets"
import { Secret } from "aws-cdk-lib/aws-secretsmanager"
import { ParameterDataType, ParameterTier, StringParameter } from "aws-cdk-lib/aws-ssm"
// import { EdgeFunction } from "aws-cdk-lib/aws-cloudfront/lib/experimental"


// orig version of cdk 2.173.4

export class CloudFrontStack extends Stack {
    publicWebBucket: Bucket
    privateWebBucket: Bucket
    certificate: any
    codeBucket: any
    authLambda: experimental.EdgeFunction
    authLambdaVersion: IVersion
    userPool: UserPool
    userPoolDomain: UserPoolDomain
    userPoolClient: UserPoolClient
    userPoolInfoSecret: Secret

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

        new CfnParameter(this, "hostedZoneId", {
            type: "String",
            description: "ID of Route53 Hosted Zone"
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
            bucketName: Fn.sub("vid-dash-private-web-${uniqueId}"),
            removalPolicy: RemovalPolicy.DESTROY
        })

        /** bucket for public web content */
        this.publicWebBucket = new Bucket(this, "publicWebBucket", {
            bucketName: Fn.sub("vid-dash-public-web-${uniqueId}"),
            cors: [{
                allowedOrigins: ["http*"],
                allowedMethods: [HttpMethods.GET],
                allowedHeaders: ["*"],
                exposedHeaders: ["Etag", "x-amx-meta-custom-header"]
            }],
            removalPolicy: RemovalPolicy.DESTROY
        })

        // create User Pool
        this.createUserPool()
        // create authorisation at edge lambda
        this.createEdgeLambda(props)
        // create CloudFront distro
        this.createCloudFrontDistro()
        // copy appropriate code to web buckets
        this.copyCodeToWebBuckets()
    }

    createUserPool() {
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

        userPool.node.addDependency(this.certificate)

        const userPoolDomain = new UserPoolDomain(this, "UserPoolDomain", {
            userPool,
            customDomain: {
                domainName: Fn.sub("auth.${domainName}"),
                certificate: this.certificate
            }
            // cognitoDomain: {
            //     domainPrefix: 'ds-fyp',
            // },
        })
        // userPool.addDomain("CamUserPoolDomain", {
        //     customDomain: {
        //         domainName: Fn.sub("auth.${domainName}"),
        //         certificate: this.certificate
        //     }
        // })

        // userPoolDomain.node.addDependency(userPoolClient)

        const userPoolClient = userPool.addClient('DashUserPoolClient', {
            generateSecret: true,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                callbackUrls: [
                    Fn.sub("https://www.${domainName}"),
                    Fn.sub("https://www.${domainName}/")
                ],
                defaultRedirectUri: Fn.sub("https://www.${domainName}")
            },
            preventUserExistenceErrors: false
        })


        // output Cognito Endpoint name
        // new CfnOutput(this, "Cognito-Endpoint", { value: userPoolDomain.cloudFrontEndpoint })
        // output UserPool ID
        new CfnOutput(this, "UserPool-Id", { value: userPool.userPoolId })
        // output UserPool Client ID
        new CfnOutput(this, "UserPool-ClientId", { value: userPoolClient.userPoolClientId })

        // new StringParameter(this, "cognitoEndpointParam", {
        //     description: "Cognito Endpoint",
        //     dataType: ParameterDataType.TEXT,
        //     tier: ParameterTier.STANDARD,
        //     parameterName: "cognito-endpoint",
        //     stringValue: userPoolDomain.cloudFrontEndpoint
        // })

        new StringParameter(this, "userPoolIdParam", {
            description: "Cognito User Pool ID",
            dataType: ParameterDataType.TEXT,
            tier: ParameterTier.STANDARD,
            parameterName: "user-pool-id",
            stringValue: userPool.userPoolId
        })

        new StringParameter(this, "userPoolClientIdParam", {
            description: "Cognito User Pool Client ID",
            dataType: ParameterDataType.TEXT,
            tier: ParameterTier.STANDARD,
            parameterName: "user-pool-client-id",
            stringValue: userPoolClient.userPoolClientId
        })

        this.userPool = userPool
        // this.userPoolDomain = userPoolDomain
        this.userPoolClient = userPoolClient
    }

    createCloudFrontDistro() {
        const originAccessControl = new S3OriginAccessControl(this, 'CameraOAC', {
            originAccessControlName: "Camera CloudFront OAC",
            description: "Camera CloudFront Origin Access Control",
            signing: Signing.SIGV4_NO_OVERRIDE
        })

        const s3Origin = S3BucketOrigin.withOriginAccessControl(this.privateWebBucket, {
            originAccessControl,
        })


        /** CloudFront Distribution */
        const cfDist = new Distribution(this, "CloudFrontDistribution", {
            enabled: true,
            comment: "CloudFormation Distribution",
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: s3Origin,
                edgeLambdas: [{
                    eventType: LambdaEdgeEventType.VIEWER_REQUEST,
                    functionVersion: this.authLambdaVersion,
                }],
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.AMPLIFY
            },
            domainNames: [Fn.sub("www.${domainName}")],
            certificate: this.certificate,
            enableLogging: false,
        })

        cfDist.node.addDependency(this.authLambda)

        // output CloudFront Distribution name
        new CfnOutput(this, "CloudFront-Distribution-Name", { value: cfDist.distributionDomainName })

        new StringParameter(this, "domainNameParam", {
            description: "Domain Name",
            dataType: ParameterDataType.TEXT,
            tier: ParameterTier.STANDARD,
            parameterName: "domain-name",
            stringValue: Fn.ref("domainName")
        })
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
        // const grantToPublicBucket = this.publicWebBucket.grantPut(copyLambda)
        const grantToPrivateBucket = this.privateWebBucket.grantPut(copyLambda)

        // const copyPublicWebResources = new CustomResource(this, "copyPublicWebResources", {
        //     serviceToken: copyLambda.functionArn,
        //     properties: {
        //         sourceBucket: this.codeBucket.bucketName,
        //         destinationBucket: this.publicWebBucket.bucketName,
        //         keys: ["public-web"]
        //     }
        // })
        // copyPublicWebResources.node.addDependency(grantToCodeBucket)
        // copyPublicWebResources.node.addDependency(grantToPublicBucket)

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
        const ssmGetParameterPolicy = new ManagedPolicy(
            this,
            "ssm-get-parameter-policy",
            {
                managedPolicyName: `ssm-get-parameter-policy`,
                statements: [
                    new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: [
                            "ssm:GetParameter"
                        ],
                        resources: [
                            "*"
                        ]
                    })
                ]
            }
        )

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
                    ssmGetParameterPolicy,
                    // secretsManagerPolicy
                ],
            }
        )

        return edgeLambdaRole
    }
}
