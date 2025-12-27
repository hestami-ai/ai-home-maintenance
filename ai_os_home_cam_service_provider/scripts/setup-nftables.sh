#!/bin/bash
set -e

# Hestami AI OS - Cloudflare Origin Lockdown Script
# Drops all traffic to TCP/443 unless it comes from Cloudflare IPs.

NFT_CONF="/etc/nftables.conf"
CLOUDFLARE_IPV4_URL="https://www.cloudflare.com/ips-v4"
CLOUDFLARE_IPV6_URL="https://www.cloudflare.com/ips-v6"

echo "Fetching Cloudflare IP ranges..."
CF_IPV4=$(curl -s $CLOUDFLARE_IPV4_URL | sed ':a;N;$!ba;s/\n/, /g')
CF_IPV6=$(curl -s $CLOUDFLARE_IPV6_URL | sed ':a;N;$!ba;s/\n/, /g')

if [ -z "$CF_IPV4" ] || [ -z "$CF_IPV6" ]; then
    echo "Error: Failed to fetch Cloudflare IPs."
    exit 1
fi

echo "Generating nftables configuration..."

cat <<EOF > $NFT_CONF
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    set cloudflare_v4 {
        type ipv4_addr
        flags interval
        elements = { $CF_IPV4 }
    }

    set cloudflare_v6 {
        type ipv6_addr
        flags interval
        elements = { $CF_IPV6 }
    }

    chain input {
        type filter hook input priority 0; policy accept;

        # Allow localhost
        iif "lo" accept

        # Allow established/related connections
        ct state established,related accept

        # Allow SSH (adjust port if needed)
        tcp dport 22 accept

        # Allow HTTP/HTTPS only from Cloudflare
        tcp dport { 80, 443 } ip saddr @cloudflare_v4 accept
        tcp dport { 80, 443 } ip6 saddr @cloudflare_v6 accept
        tcp dport { 80, 443 } drop
    }

    chain forward {
        type filter hook forward priority 0; policy accept;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
EOF

echo "Reloading nftables..."
nft -f $NFT_CONF

echo "Cloudflare Origin Lockdown enabled."
