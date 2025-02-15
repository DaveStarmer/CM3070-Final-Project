// based on https://constructs.dev/packages/@cloudcomponents/cdk-cloudfront-authorization/v/2.4.0?lang=typescript

import { SpaAuthorization, SpaDistribution } from '@cloudcomponents/cdk-cloudfront-authorization'
import { Stack, StackProps, aws_cognito } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class CloudFrontStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props)

        const userPool = new aws_cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: false,
            userPoolName: 'cloudfront-authorization-userpool',
        })

        // UserPool must have a domain!
        userPool.addDomain('Domain', {
            cognitoDomain: {
                domainPrefix: 'cloudcomponents',
            },
        })

        const authorization = new SpaAuthorization(this, 'Authorization', {
            userPool,
        })

        new SpaDistribution(this, 'Distribution', {
            authorization,
        })
    }
}