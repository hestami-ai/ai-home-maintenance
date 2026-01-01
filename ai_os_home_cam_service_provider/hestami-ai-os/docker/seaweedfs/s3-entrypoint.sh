#!/bin/sh
# Generate s3.json from environment variables
cat > /etc/seaweedfs/s3.json << EOF
{
    "identities": [
        {
            "name": "admin",
            "credentials": [
                {
                    "accessKey": "${S3_ACCESS_KEY:-hestami_admin}",
                    "secretKey": "${S3_SECRET_KEY:-hestami_secret}"
                }
            ],
            "actions": [
                "Admin",
                "Read",
                "List",
                "Tagging",
                "Write"
            ]
        }
    ]
}
EOF

# Execute the original command
exec weed "$@"
