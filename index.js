"use strict";
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const awsx = require("@pulumi/awsx");
const fs = require("fs");
const path = require("path");


// Settings
const INSTANCE_SIZE = "t3.medium"

// Utility

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(
        (file) => {
            var filepath = path.join(dir, file);
            var stat = fs.statSync(filepath);
            if (stat.isDirectory()) {
                walk(filepath, callback);
            } else {
                callback(filepath, stat);
            }
        }
    )
}

function getStartupScript(bucketName) {
    // WARNING: changing startup script will require creating new 
    // instance and deleting old ones!

    // must return a plain string of bash script
    var content = {};

    walk("./server-code/", (filepath, stats) => {
        var content_key = filepath.replace(__dirname, "").replace("\\", "/");
        content[content_key] = fs.readFileSync(filepath).toString();
    });
    let userData = `
#!/bin/bash

echo "Initializing.."
echo "Setting main Minecraft S3 bucket to: ${bucketName}"

export MC_BUCKET=${bucketName}

yum update -y
yum -y install docker
service docker start
`;

    Object.keys(content).forEach((key) => {
        var scriptString = content[key];
        userData += `
echo "Writing script: ${key}"
mkdir -p /opt/${path.dirname(key)}
echo "${scriptString}" > /opt/${key}
`
    })

    userData += `
bash /opt/server-code/restore.sh
bash /opt/server-code/build_minecraft.sh
bash /opt/server-code/run_minecraft.sh
`
    return userData;
}

// Declare Resources

function useMainStorageBucket() {
    const bucket = new aws.s3.Bucket("main-storage");
    return bucket;
}

function getEC2AMI() {
    let ami = aws.getAmi({
        filters: [{
            name: "name",
            values: ["amzn-ami-hvm-*"],
        }],
        owners: ["137112412989"], // This owner ID is Amazon
        mostRecent: true,
    });
    return ami;
}

function useManagerKeyPair() {
    const serverSshPubKey = new aws.ec2.KeyPair("mc-ghosalya", {
        publicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC4GApGQQTDbaMrdh1Z769R3h/D/m3nCmaZqRUuOQ1TbBnxyEupC1cMjY6lkESA8DeniJby/04aPrgJdE5XRemxe8LhC3/oVtCPz9w2wr8T73XSIWemmFG43bzC/wQV+h79yZ3qzjTPnc/h6o94IEyX2qOOtyYIbYKW9bwFY+DP6+PDQc/V9IF171t6o6RLrBTflM2t5VHVyj+rUegncg+uuvfq892J9B5+AuqD/1ARObgw3U1LhMHtk4JgmX24QpeTY8MyAaP9e+55RJ8Zx14r4lWvwh712k7+xrpHAWDmIhcLDuomWS+wEsLqka51L44QmJBS3RQDMYjq6YcCVWsz",
    });

    return serverSshPubKey;
}

function useEC2Server(mainBucket) {

    // Give EC2 permission to S3
    const role = new aws.iam.Role("access-s3-role", {
        assumeRolePolicy: mainBucket.bucket.apply((bucketName) => {
            // TODO: figure out how to give S3 access to EC2
            return `{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "s3:*",
                        "Resource": [
                            "arn:aws:s3:::${bucketName}",
                            "arn:aws:s3:::${bucketName}/*"
                        ]
                    }
                ]
            }
            `
        }),
        path: "/",
    });
    const instanceProfile = new aws.iam.InstanceProfile("server-access-s3", {
        role: role.name,
    });

    let group = new aws.ec2.SecurityGroup(
        "mc-server-group", 
        {
            ingress: [
                { protocol: "icmp", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },  // SSH
                { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },  // SSH
                { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },  // TCP
                { protocol: "tcp", fromPort: 3389, toPort: 3389, cidrBlocks: ["0.0.0.0/0"] },  // TCP
                { protocol: "tcp", fromPort: 25565, toPort: 25565, cidrBlocks: ["0.0.0.0/0"] },  // MC TCP
                { protocol: "udp", fromPort: 25565, toPort: 25565, cidrBlocks: ["0.0.0.0/0"] },  // MC TCP
            ],
            egress: [
                { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },  // Allow all egress
            ]
        }
    );

    let keypair = useManagerKeyPair();

    let server = new aws.ec2.Instance(
        "server-instance", 
        {
            instanceType: INSTANCE_SIZE,
            securityGroups: [ group.name ], // reference the security group resource above
            keyName: keypair.keyName,
            ami: getEC2AMI().id,
            iamInstanceProfile: instanceProfile.id,
            userData: mainBucket.bucket.apply(getStartupScript),
        }
    );

    return {
        securityGroup: group,
        serverInstance: server,
    }
}

// API Contents

function getServerDescription(server_ip) {
    return `
    Hello from Minecraft Control Panel API!

    Server IP: ${server_ip}

    `
}

function useControlPanelAPI(server_ip) {
    // Define a new GET endpoint that just returns a 200 and "hello" in the body.
    const api = new awsx.apigateway.API("mc-api", {
        routes: [
            {
                path: "/",
                method: "GET",
                eventHandler: async (event) => {
                    // This code runs in an AWS Lambda anytime `/` is hit.
                    return {
                        statusCode: 200,
                        body: getServerDescription(server_ip.get()),
                    };
                },
            },
            {
                path: "/start",
                method: "GET",
                eventHandler: async (event) => {
                    // This code runs in an AWS Lambda anytime `/` is hit.
                    return {
                        statusCode: 200,
                        body: getServerDescription(server_ip.get()),
                    };
                },
            },
            {
                path: "/stop",
                method: "GET",
                eventHandler: async (event) => {
                    // This code runs in an AWS Lambda anytime `/` is hit.
                    return {
                        statusCode: 200,
                        body: getServerDescription(server_ip.get()),
                    };
                },
            },
        ],
    })
    return api;
}

// Main Execution Block

let storage = useMainStorageBucket();
let server = useEC2Server(storage);
let api = useControlPanelAPI(server.publicIp);

// Export the name of the bucket
exports.bucketName = storage.bucket;
exports.serverInstance = server.serverInstance.id;
exports.publicIp = server.serverInstance.publicIp;
exports.hostname = server.serverInstance.publicDns;
exports.userData = server.serverInstance.userData;
exports.apiUrl = api.url;