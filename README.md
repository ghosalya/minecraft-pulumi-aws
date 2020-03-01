# minecraft-pulumi-aws

A minecraft server deployment & control panel, built with `pulumi`.

## pulumi

This project uses `pulumi-aws-python`.

To install Pulumi, follow this link: https://www.pulumi.com/docs/get-started/aws/install-pulumi/

To login:
```
pulumi login s3://ghosalya-pulumi-stacks
```

The config requires a password. To save the password in your session, on Powershell you can do
```
$env:PULUMI_CONFIG_PASSPHRASE="<replace-with-password>"
```


## Infrastructure

The project will manage the following infrastructure in AWS:

1. An ECS instance based on https://hub.docker.com/r/itzg/minecraft-server/
2. An S3 Bucket that contains:
    * `backup/` directory for storing backup files
    * `backup/latest.zip` default backup to use for restoration
