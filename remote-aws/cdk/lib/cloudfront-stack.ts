import { CfnCustomResource, CfnElement, CfnOutput, CfnParameter, CustomResource, Duration, Fn, Names, RemovalPolicy, SecretValue, Stack, StackProps } from "aws-cdk-lib"
import { Certificate, ICertificate } from "aws-cdk-lib/aws-certificatemanager"
import { CfnCloudFrontOriginAccessIdentity, Distribution, LambdaEdgeEventType, OriginAccessIdentity, S3OriginAccessControl, experimental, Signing, ViewerProtocolPolicy, CachePolicy, AccessLevel } from "aws-cdk-lib/aws-cloudfront"
import { HttpOrigin, S3BucketOrigin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins"
import { CfnUserPoolUser, LambdaVersion, UserPool, UserPoolClient, UserPoolDomain, VerificationEmailStyle } from "aws-cdk-lib/aws-cognito"
import { CanonicalUserPrincipal, CompositePrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal, User } from "aws-cdk-lib/aws-iam"
import { ApplicationLogLevel, Code, Function, IVersion, LoggingFormat, Runtime, Version } from "aws-cdk-lib/aws-lambda"
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53"
import { Bucket, EventType, HttpMethods, IBucket } from "aws-cdk-lib/aws-s3"
import { Construct } from "constructs"
import { Domain } from "domain"
import { UserPoolUser } from "./constructs/UserPoolUser"
import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets"
import { Secret } from "aws-cdk-lib/aws-secretsmanager"
import { ParameterDataType, ParameterTier, StringParameter } from "aws-cdk-lib/aws-ssm"

// orig version of cdk 2.173.4


export class CloudFrontStack extends Stack {
    publicWebBucket: Bucket
    privateWebBucket: Bucket
    certificate: ICertificate
    codeBucket: IBucket
    authLambda: experimental.EdgeFunction
    authLambdaVersion: IVersion
    responseLambda: experimental.EdgeFunction
    responseLambdaVersion: IVersion
    userPool: UserPool
    userPoolClient: UserPoolClient
    userPoolInfoSecret: Secret

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        // elements passed in as parameters
        /** CloudFormation Parameter for Unique ID to add to resource names where necessary */
        const uniqueId = new CfnParameter(this, "uniqueId", {
            type: "String",
            description: "Unique element for resource naming",
            allowedPattern: "^[a-z0-9-]{1,32}$"
        }).toString()


        new CfnParameter(this, "publicUniqueId", {
            type: "String",
            description: "Unique element for public resource naming",
        })

        // name of code bucket
        new CfnParameter(this, "codeBucketName", {
            type: "String",
            description: "Code bucket name",
            allowedPattern: "^[a-z0-9\.-]{1,64}$",
            default: "instruct-cf-code-ec0c1faa4de3482c9bdc0081a3ec4"
        })

        // location of code bucket
        new CfnParameter(this, "codeBucketRegion", {
            type: "String",
            description: "Code Bucket Region",
            allowedPattern: "^[a-z0-9-]{1,12}$",
            default: props?.env?.region
        })

        new CfnParameter(this, "apiDomainName", {
            type: "String",
            description: "API Domain Name (output from dashboard stack)"
        })

        /** code bucket construct */
        this.codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref("codeBucketName"))

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

        // create User Pool
        this.createUserPool()
        // create authorisation at edge lambda
        this.createAuthEdgeLambda(props)
        // create response edge lambda
        this.createResponseEdgeLambda()
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
                emailBody: "Hello {username}. You have been invited to join the Surveillance System. Your temporary password is {####} - please use this to log in for the first time."
            }
        })

        userPool.node.addDependency(this.certificate)


        const userPoolDomain = userPool.addDomain("userPoolDashDomain", {
            customDomain: {
                domainName: Fn.sub("auth.${domainName}"),
                certificate: this.certificate
            }
        })

        const userPoolClient = userPool.addClient('dashUserPoolClient', {
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

        // output UserPool ID
        new CfnOutput(this, "UserPool-Id", { value: userPool.userPoolId })
        // output UserPool Client ID
        new CfnOutput(this, "UserPool-ClientId", { value: userPoolClient.userPoolClientId })

        new StringParameter(this, "cognitoEndpointParam", {
            description: "Cognito Endpoint",
            dataType: ParameterDataType.TEXT,
            tier: ParameterTier.STANDARD,
            parameterName: "cognito-endpoint",
            stringValue: userPoolDomain.cloudFrontEndpoint
        })

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


        const upClientOutput = new StringParameter(this, "userPoolClientSecret", {
            description: "Cognito User Pool Client Secret",
            dataType: ParameterDataType.TEXT,
            tier: ParameterTier.STANDARD,
            parameterName: "user-pool-client-secret",
            stringValue: Fn.getAtt(
                // getting logical id from https://stackoverflow.com/a/67196352
                this.resolve((userPoolClient.node.defaultChild as CfnElement).logicalId),
                "ClientSecret"
            ).toString()
            // stringValue: userPoolClient.userPoolClientSecret.unsafeUnwrap()
        })
        upClientOutput.node.addDependency(userPoolClient)

        this.userPool = userPool
        this.userPoolClient = userPoolClient
    }

    createCloudFrontDistro() {
        const origin = S3BucketOrigin.withOriginAccessControl(this.privateWebBucket, {
            originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
        })

        const apiOrigin = new HttpOrigin(
            Fn.select(0, Fn.split("/", Fn.select(0, Fn.split("https://", Fn.ref("apiDomainName")))))
        )

        /** CloudFront Distribution */
        const cfDist = new Distribution(this, "cloudFrontDistribution", {
            enabled: true,
            comment: "CloudFront Distribution",
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin,
                edgeLambdas: [
                    {
                        eventType: LambdaEdgeEventType.VIEWER_REQUEST,
                        functionVersion: this.authLambdaVersion,
                    },
                    {
                        eventType: LambdaEdgeEventType.VIEWER_RESPONSE,
                        functionVersion: this.responseLambdaVersion
                    }
                ],
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_DISABLED
            },
            additionalBehaviors: {
                "activations/*": {
                    origin: apiOrigin
                }
            },
            domainNames: [Fn.sub("www.${domainName}"), Fn.ref("domainName")],
            certificate: this.certificate,
            enableLogging: false,
        })

        cfDist.node.addDependency(this.authLambda)
        cfDist.node.addDependency(this.responseLambda)

        // output CloudFront Distribution name
        new CfnOutput(this, "cloudFrontDistributionId", { value: cfDist.distributionId })
        new CfnOutput(this, "cloudFrontDistributionDomainName", { value: cfDist.distributionDomainName })

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
        const lambdaKey = this.node.tryGetContext("lambdas")["copy-web-code"]
        const copyLambda = new Function(this, "copyBetweenBuckets", {
            timeout: Duration.minutes(15),
            runtime: Runtime.PYTHON_3_13,
            handler: "handler.handler_function",
            code: Code.fromBucketV2(this.codeBucket, `lambdas-cf/${lambdaKey}`)
        })

        const grantToCodeBucket = this.codeBucket.grantRead(copyLambda)
        const grantToPrivateBucket = this.privateWebBucket.grantPut(copyLambda)

        const copyPrivateWebResources = new CustomResource(this, "copyPrivateWebResources", {
            serviceToken: copyLambda.functionArn,
            properties: {
                sourceBucket: this.codeBucket.bucketName,
                destinationBucket: this.privateWebBucket.bucketName,
                keys: ["dashboard-web"]
            }
        })
        copyPrivateWebResources.node.addDependency(grantToCodeBucket)
        copyPrivateWebResources.node.addDependency(grantToPrivateBucket)

        // copy config file across
        const copyApiConfig = new CustomResource(this, "copyApiConfig", {
            serviceToken: copyLambda.functionArn,
            properties: {
                sourceRegion: "eu-west-2",
                sourceBucket: Fn.sub("vid-dash-config-${uniqueId}"),
                destinationRegion: "us-east-1",
                destinationBucket: this.privateWebBucket.bucketName,
                keys: ["config.json"],
                stripPrefix: "false",
            }
        })

        // grant read and list rights to the config bucket
        Bucket.fromBucketName(this, "configBucketReference",
            Fn.sub("vid-dash-config-${uniqueId}")).grantRead(copyLambda)

    }

    /** Deploy Edge Lambda */
    createAuthEdgeLambda(props?: StackProps) {
        const lambdaKey = this.node.tryGetContext("lambdas")["edge-auth"]
        const lambdaRole = this.createAuthEdgeLambdaRole()

        this.authLambda = new experimental.EdgeFunction(this, "authLambda", {
            ...props,
            functionName: "edge-auth",
            runtime: Runtime.PYTHON_3_13,
            code: Code.fromBucketV2(this.codeBucket, `lambdas-cf/${lambdaKey}`),
            timeout: Duration.seconds(5),
            handler: "handler.handler_function",
            role: lambdaRole,
            applicationLogLevelV2: ApplicationLogLevel.DEBUG,
            loggingFormat: LoggingFormat.JSON,
            description: "Authorisation Edge Lambda"
        })

        this.authLambdaVersion = this.authLambda.currentVersion
    }

    /** Deploy Edge Lambda */
    createResponseEdgeLambda(props?: StackProps) {
        const lambdaKey = this.node.tryGetContext("lambdas")["edge-response"]
        const lambdaRole = this.createResponseEdgeLambdaRole()

        this.responseLambda = new experimental.EdgeFunction(this, "responseLambda", {
            ...props,
            functionName: "edge-response",
            runtime: Runtime.PYTHON_3_13,
            code: Code.fromBucketV2(this.codeBucket, `lambdas-cf/${lambdaKey}`),
            timeout: Duration.seconds(5),
            handler: "handler.handler_function",
            role: lambdaRole,
            applicationLogLevelV2: ApplicationLogLevel.DEBUG,
            loggingFormat: LoggingFormat.JSON,
            description: "Response Edge Lambda"
        })

        this.responseLambdaVersion = this.responseLambda.currentVersion
    }

    createAuthEdgeLambdaRole() {
        const ssmGetParameterPolicy = new ManagedPolicy(
            this,
            "ssmGetParameterPolicy",
            {
                managedPolicyName: "auth-lambda-get-parameter-policy",
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

        const cloudWatchLogsPolicy = new ManagedPolicy(
            this,
            "authCloudWatchLogsPolicy",
            {
                managedPolicyName: "auth-lambda-logs-policy",
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
            "edgeAuthRole",
            {
                roleName: "edge-auth-lambda-role",
                assumedBy: new CompositePrincipal(
                    new ServicePrincipal("lambda.amazonaws.com"),
                    new ServicePrincipal("edgelambda.amazonaws.com")
                ),
                managedPolicies: [
                    cloudWatchLogsPolicy,
                    ssmGetParameterPolicy
                ],
            }
        )

        return edgeLambdaRole
    }

    createResponseEdgeLambdaRole() {
        const cloudWatchLogsPolicy = new ManagedPolicy(
            this,
            "responseCloudWatchLogsPolicy",
            {
                managedPolicyName: "response-lambda-logs-policy",
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
            "edgeResponseRole",
            {
                roleName: "edge-response-lambda-role",
                assumedBy: new CompositePrincipal(
                    new ServicePrincipal("lambda.amazonaws.com"),
                    new ServicePrincipal("edgelambda.amazonaws.com")
                ),
                managedPolicies: [
                    cloudWatchLogsPolicy
                ],
            }
        )

        return edgeLambdaRole
    }
}
