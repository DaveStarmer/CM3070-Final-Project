import { CfnCondition, CfnParameter, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SpaAuthorization, SpaDistribution } from '@cloudcomponents/cdk-cloudfront-authorization';
import { AccessLevel, Distribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import path = require('path');
import { BooleanAttribute, CfnUserPoolUser, UserPool, UserPoolDomain, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets'

// uses CloudComponents' CDK-Cloudfront-Authorisation
// https://www.npmjs.com/package/@cloudcomponents/cdk-cloudfront-authorization

export class CloudFrontStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // --- implementation-specific parameters ---
        // (descriptions in 'description' field)
        new CfnParameter(this, "uniqueId", {
            type: "String",
            description: "Unique element for resource naming",
            allowedPattern: "^[a-z0-9-]{1,32}$",
            default: props?.env?.account
        });

        new CfnParameter(this, "domainName", {
            type: "String",
            description: "Name of domain configured outside CDK",
            // allowedPattern: "^(?!www\\.)(?:[a-z0-9_\\.-][a-z0-9_\\.-]{1,62}){2,6}$",
            default: ""
        })

        const adminUserEmail = new CfnParameter(this, "adminUser", {
            type: "String",
            description: "Email address of initial admin user",
            default: ""
        })

        new CfnParameter(this, "certificateArn", {
            type: "String",
            description: "ARN of certificate for domain"
        })

        /** user pool for dashboard */
        const userPool = new UserPool(this, "UserPool", {
            selfSignUpEnabled: false,
            userPoolName: "dashboard-user-pool",
            standardAttributes: {
                // require email for user
                email: { required: true, mutable: true },
                // in a production environment, phone should be required as well
                // phoneNumber: {required: true, mutable: true}
            },
            customAttributes: {
                'isAdmin': new BooleanAttribute({ mutable: true })
            },
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

        /** certificate for domain */
        const certificate = Certificate.fromCertificateArn(this, "Certificate", Fn.ref("certificateArn"))

        // add domain to user pool
        // userPool.addDomain('DashboardDomain', {
        //     customDomain: {
        //         domainName: Fn.sub("www.${domainName}"),
        //         certificate
        //     }
        //     // cognitoDomain: {
        //     //     domainPrefix: "cam-dash"
        //     // }
        // })
        const userPoolDomain = new UserPoolDomain(this, "UserPoolDomain", {
            userPool,
            customDomain: {
                domainName: Fn.sub("auth.${domainName}"),
                certificate
            }
        })
        /** hosted zone for current domain */
        const hostedZone = HostedZone.fromLookup(this, "HostedZoneLookup", {
            domainName: Fn.ref("domainName")
        })

        // create A Record for User Pool
        new ARecord(this, 'UserPoolCloudFrontAliasRecord', {
            zone: hostedZone,
            recordName: Fn.sub("auth.${domainName}"),
            target: RecordTarget.fromAlias(),
            // target: RecordTarget.fromAlias(new UserPoolDomainTarget(userPoolDomain)),
        })

        // Create seed admin user if email supplied
        const adminUser = new CfnUserPoolUser(this, "InitialAdminUser", {
            userPoolId: userPool.userPoolId,
            username: Fn.ref("adminUser")
        })
        adminUser.cfnOptions.condition = new CfnCondition(this, "CreateAdminUser", {
            expression: Fn.conditionNot(Fn.conditionEquals(Fn.ref("adminUser"), ""))
        })

        /** authorisation construct
         *  deals with authorisation of users
         */
        const authorization = new SpaAuthorization(this, "Authorisation", {
            userPool
        })

        // distribution for authorisation
        new SpaDistribution(this, "Distribution", {
            authorization
        })

        /** bucket to contain web pages */
        const webBucket = new Bucket(this, "WebBucket", {
            bucketName: Fn.sub("web-bucket-${uniqueId}"),
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY
        })

        /** bucket origin for web pages
         *  allows access to the bucket for serving web pages
         */
        const webBucketOrigin = S3BucketOrigin.withOriginAccessControl(webBucket, {
            originAccessLevels: [AccessLevel.READ]
        })

        new Distribution(this, "WebDistribution", {
            defaultBehavior: authorization.createDefaultBehavior(webBucketOrigin)
        })

        new BucketDeployment(this, "UploadWebPages", {
            sources: [Source.asset(path.join(__dirname, "..", "..", "..", "remote-dashboard", "web"))],
            destinationBucket: webBucket
        })
    }
}
