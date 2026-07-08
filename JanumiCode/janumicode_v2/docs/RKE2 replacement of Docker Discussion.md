

Network:
- Static LAN IP for RKE2 VM
- Router forwards 443, optionally 80, to RKE2 VM
- Cloudflare DNS records proxied to your public IP
- Cloudflare SSL/TLS mode: Full (strict)

Network Topology:

Internet
  ↓
Cloudflare
  ↓
Router NAT :443/:80
  ↓
Hyper-V bridged network
  ↓
RKE2 VM LAN IP
  ↓
Traefik inside RKE2
  ↓
Kubernetes Services / Pods

Host/VM:
- Ubuntu Server/Rocky/Debian VM
- 4 vCPU, 40–48 GB RAM
- SSD-backed fixed-size VHDX if possible
- time sync working
- no random host firewall blockage

Certificates:
- Cloudflare Origin Certificate + private key
- Optional Cloudflare Authenticated Origin Pull CA cert
- Internal admin DNS name for Kubernetes API if desired

RKE2:
- config.yaml
- install token if adding future nodes
- CNI decision: Cilium vs Canal/Calico
- disable bundled ingress-nginx if using Traefik

Post-install:
- kubeconfig copied securely
- etcd snapshot location
- off-host backup target
- namespaces/RBAC baseline
- Traefik Helm values
- Kubernetes TLS secrets

RKE2 VM:
- Ubuntu Server LTS
- 4 vCPU
- 40–48 GB RAM
- 250–300 GB SSD VHDX
- static LAN IP

RKE2:
- single server node
- disable rke2-ingress-nginx
- use Cilium if you want stronger network/security features
- otherwise Canal/Calico for lower complexity

Ingress:
- Traefik installed by Helm
- Cloudflare Origin Cert as Kubernetes TLS secret
- Cloudflare Full Strict
- router forwards 443 to RKE2 VM

Security:
- do not expose 6443/9345 publicly
- enable Kubernetes NetworkPolicy
- use Pod Security Admission
- add external-secrets or sealed-secrets later
- defer service mesh mTLS initially

My read: **RKE2 changes the infrastructure model substantially, but it does not eliminate Vault, OpenSandbox, or Docker/container isolation concerns.** It changes *where* they belong.

## Direct answer

| Draft item                                      | With RKE2 single-node                                                                                 | Recommendation                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Docker as top-level runtime**                 | Replaced by Kubernetes/RKE2 + containerd for platform services                                        | Change the draft language from “Docker containers” to “Kubernetes workloads / containerized workloads.”   |
| **Docker for hardened execution**               | Still relevant as a *concept*, but mediated through Kubernetes/containerd, not ad hoc Docker networks | Keep the hardening requirements: seccomp, AppArmor, rootless/non-root, no-network default, resource caps. |
| **HashiCorp Vault CE**                          | **Still needed**                                                                                      | RKE2/Kubernetes Secrets are not a vault-of-record replacement.                                            |
| **OpenSandbox**                                 | Still likely needed for ephemeral untrusted build/test/agent execution                                | But its role should be re-evaluated under Kubernetes rather than “OpenSandbox on Docker.”                 |
| **Traefik**                                     | Still needed                                                                                          | Best placed inside RKE2 as ingress controller.                                                            |
| **Network segmentation**                        | Better expressed with namespaces, NetworkPolicy, Cilium/Calico, and admission policy                  | Replace Docker network segmentation language.                                                             |
| **Tenant apps as long-lived Docker containers** | Better as Kubernetes Deployments/Pods with per-app Service/IngressRoute                               | Replace Docker-hosted-app model with Kubernetes-hosted-app model.                                         |

## Vault: do not remove it

The draft currently says Vault CE is the **sole per-tenant credential vault of record**, and OpenSandbox’s credential vault was rejected because the earlier architecture assumed single-node Docker rather than Kubernetes. 

With RKE2, the reasoning changes slightly, but the conclusion mostly does **not**.

RKE2 can encrypt Kubernetes Secrets at rest and rotate encryption keys, and Kubernetes supports encryption of API data at rest. ([RKE2 Documentation][1]) But Kubernetes Secrets are still cluster API objects, RBAC-exposed to authorized readers/controllers/pods, and the Kubernetes docs explicitly recommend encryption at rest, least-privilege RBAC, limiting container access, and considering external secret stores. ([Kubernetes][2])

So:

```text
RKE2 secrets encryption = protect Kubernetes Secret storage in etcd
Vault = credential authority / vault of record / dynamic secret issuer
```

For Janumi, Vault remains justified for:

```text
- BYOK model credentials
- platform-managed provider keys
- per-tenant secret paths/policies
- short-lived tenant-app DB credentials
- scoped S3/object-storage credentials
- auditability of secret access
- dynamic credential issuance/rotation
```

Kubernetes Secrets should become **last-mile delivery**, not authoritative custody.

## OpenSandbox: keep the function, revisit the implementation

The draft says OpenSandbox is the **untrusted-workload boundary** for ephemeral build/test/agent execution only, while hosted apps and core services are not inside OpenSandbox.  That distinction is still sound.

Under RKE2, I would restate the architecture as:

```text
Control plane:
  Kubernetes workloads in trusted namespaces

Execution plane:
  OpenSandbox or equivalent sandbox runner
  launched as isolated, ephemeral Kubernetes jobs/pods

Tenant app plane:
  long-lived Kubernetes deployments
  not OpenSandbox
```

The key change: OpenSandbox should no longer be described primarily as **“OpenSandbox on Docker.”** It should be described as the **sandbox abstraction behind the Compute Broker**, with an RKE2/Kubernetes backend if practical.

## Docker: remove as the organizing architecture

The draft’s `DEC-INTENT-20` is explicitly framed around “three Docker trust tiers.”  Under RKE2, that should become:

```text
DEC-INTENT-20 revised:
Single-node RKE2 topology with three Kubernetes trust zones:
1. trusted platform namespace(s)
2. ephemeral sandbox namespace(s)
3. tenant-app namespace(s)
```

Replace:

```text
Docker networks + default deny
```

with:

```text
Kubernetes namespaces
NetworkPolicy / Cilium policy
Pod Security Admission
securityContext
seccomp/AppArmor
ResourceQuota / LimitRange
RBAC
admission policy
```

RKE2 has hardening guidance and secure-by-default Pod Security Standards/NetworkPolicy behavior, which fits this direction. ([RKE2 Documentation][3])

## Revised installation requirements

For your RKE2 version of the platform, the real baseline becomes:

```text
Required:
- RKE2 single-node Linux VM
- Traefik ingress in-cluster
- Cloudflare Origin Cert as Kubernetes TLS secret
- RKE2 secrets encryption enabled
- Vault CE deployed in-cluster or adjacent to cluster
- Cilium or Calico for NetworkPolicy
- Pod Security Admission baseline/restricted
- cert-manager optional, depending on cert flow
- External Secrets Operator or Vault Agent Injector recommended
- etcd snapshots + off-host backup
- separate platform Postgres and tenant-app Postgres
- SeaweedFS or S3-compatible storage with scoped credentials
```

## My architectural recommendation

Keep the **logic** of the draft, but change the substrate:

```text
Cloudflare
  → router NAT :443
  → RKE2 VM
  → Traefik ingress
  → platform / sandbox / tenant-app namespaces
```

And revise the draft’s three controversial references this way:

```text
HashiCorp Vault:
  KEEP. RKE2 does not replace it.

OpenSandbox:
  KEEP AS CAPABILITY / ABSTRACTION.
  Re-evaluate backend integration under Kubernetes.

Docker:
  REPLACE AS ARCHITECTURAL LANGUAGE.
  Use Kubernetes/containerd/pods/jobs/deployments/security policies.
```

Bottom line: **RKE2 reduces the need for hand-built Docker topology, but it does not replace Vault, and it does not by itself solve untrusted code execution.** It gives you the substrate to express the platform more cleanly and securely.

[1]: https://docs.rke2.io/security/secrets_encryption?utm_source=chatgpt.com "Secrets Encryption"
[2]: https://kubernetes.io/docs/concepts/configuration/secret/?utm_source=chatgpt.com "Secrets"
[3]: https://docs.rke2.io/security/pod_security_standards?utm_source=chatgpt.com "Default Pod Security Standards"
