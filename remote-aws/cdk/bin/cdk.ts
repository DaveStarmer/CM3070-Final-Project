#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DashboardStack } from '../lib/dashboard-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';
import { Environment } from 'aws-cdk-lib/aws-appconfig';

const app = new cdk.App();
new CloudFrontStack(app, "CloudFrontStack", {
  // override region as CloudFront must be deployed in us-east-1
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" }
})
new DashboardStack(app, 'DashboardStack', {});