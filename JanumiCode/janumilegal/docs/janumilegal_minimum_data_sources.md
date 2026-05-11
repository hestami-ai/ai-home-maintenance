I assume you mean **JanumiLegal** here. From a RAG perspective, the minimum viable corpus should be organized around **source authority, matter context, firm knowledge, and procedural production artifacts**.

The mistake would be to build one large “legal RAG bucket.” JanumiLegal needs **typed retrieval**, because a court filing draft, a client advice draft, a research memo, and a redline workflow need different source classes and different confidence labels.

# Minimal RAG source stack

## 1. Federal primary law

This is the baseline corpus for federal-law questions, federal litigation, criminal/federal practice, bankruptcy, immigration, employment, civil rights, administrative law, and regulated business matters.

Minimum sources:

```text
United States Code
Code of Federal Regulations
Federal Register
Federal Rules of Civil Procedure
Federal Rules of Criminal Procedure
Federal Rules of Evidence
Federal Rules of Appellate Procedure
Federal Bankruptcy Rules
Local federal court rules
Federal agency guidance, where relevant
```

GovInfo is a key official source for the U.S. Code; it describes the U.S. Code as the codification by subject matter of the general and permanent laws of the United States and notes that GovInfo contains U.S. Code material from 1994 forward. ([GovInfo][1])

GovInfo is also an official source for the CFR, which it describes as the codification of general and permanent federal agency rules published in the Federal Register. ([GovInfo][2]) The Federal Register itself is the official daily publication for federal rules, proposed rules, notices, executive orders, and other presidential documents, updated daily on business days. ([GovInfo][3])

**JanumiLegal use:**

```text
Legal Research Memo Lens
Court Filing Draft Lens
Direct Legal Conclusion Lens
Authority Verification Lens
Compliance Obligation Lens
```

---

## 2. State primary law

For any practical law-firm product, state law is not optional. If the first customer is Maryland-heavy, begin with Maryland, then expand by jurisdiction profile.

Minimum state sources:

```text
State code / statutes
State administrative regulations
State rules of civil procedure
State rules of criminal procedure
State rules of evidence
State family law rules
State appellate rules
State court local rules
State judiciary forms
State court self-help/procedural materials
State attorney general opinions, where useful
State agency guidance, where practice-relevant
```

For Maryland family-law or litigation workflows, Maryland Courts’ official forms are a useful procedural source; Maryland’s family-law form index includes categories such as divorce, custody, child support, domestic violence, guardianship, juvenile, name change, and financial forms. ([GovInfo][3])

**JanumiLegal use:**

```text
Filing form assembly
Local rule checklist
Client advice draft
Family law production
Criminal defense production
Civil litigation production
Court-ready filing draft
```

For the MVP, I would make **Maryland primary law + Maryland court forms + Maryland rules** the first state-law corpus if JC Law is the first design partner.

---

## 3. Federal and state court decisions

You need court decisions for legal research, authority support assessment, adverse authority search, citation grounding, and direct legal conclusion drafting.

Minimum sources:

```text
U.S. Supreme Court opinions
Federal appellate opinions
Federal district court opinions
State supreme court opinions
State intermediate appellate opinions
Selected trial court opinions where available
```

CourtListener is probably the best open starting point. Free Law Project describes CourtListener as a fully searchable archive of opinions, oral arguments, judges, judicial financial records, and federal filings. It reports more than **10 million opinions** across hundreds of jurisdictions. ([Free Law Project][4])

For federal filings and dockets, CourtListener’s RECAP Archive is particularly important. Free Law Project describes RECAP as containing nearly every federal case, hundreds of millions of docket entries, and tens of millions of legal documents. ([Free Law Project][4]) CourtListener also provides APIs to retrieve dockets, entries, parties, and attorneys from PACER/RECAP-derived data. ([CourtListener][5])

**JanumiLegal use:**

```text
Authority Retrieval Agent
Authority Classification Agent
Adverse Authority Agent
Citation/Quote Match Agent
Court Filing Draft Agent
Procedural Posture Agent
Timeline Builder Agent
```

Important caveat: public court-opinion RAG is not the same as a citator. JanumiLegal should not claim “good law verified” unless it has a reliable citator source or attorney confirmation.

---

## 4. Court rules, local rules, forms, and filing instructions

For JanumiLegal’s filing-draft workflows, this corpus is as important as case law.

Minimum sources:

```text
State court forms
Federal court forms
Local court rules
Standing orders
Judge-specific procedures, where public
Clerk filing instructions
Court fee schedules
E-filing instructions
Certificates of service requirements
Caption/signature requirements
```

This source class supports a different kind of RAG: **procedural compliance retrieval**, not legal reasoning.

**JanumiLegal use:**

```text
Court Filing Draft Lens
Filing Assembly View
Release Gate Evaluator
Court Rule Compliance Check
Certificate of Service Validator
Local Rule Checklist
```

This is one of the best places to get high reliability because many requirements are structured and publicly available.

---

## 5. Matter-specific documents

This is mandatory. JanumiLegal cannot produce good legal work from public law alone.

Minimum matter sources:

```text
client intake notes
client messages
uploaded documents
court orders
pleadings
motions
police reports
charging documents
contracts
settlement agreements
financial statements
text/email evidence
discovery
docket sheets
prior correspondence
firm notes
```

This corpus should be separated from public law and retrieved under stricter privilege/confidentiality controls.

**JanumiLegal use:**

```text
Fact Extraction Agent
Timeline Builder Agent
Source-to-Claim Trace
Court Filing Draft Agent
Client Advice Draft Agent
Legal Conclusion Draft Agent
Attorney Review Packet Agent
```

This is the source layer that answers:

```text
What facts do we actually have?
Which facts are document-supported?
Which facts are client-reported?
Which facts are missing?
Which claims in the draft rely on which document?
```

---

## 6. Firm knowledge and work product

This is what makes JanumiLegal useful to firms rather than just legally literate.

Minimum firm sources:

```text
prior research memos
model motions
model pleadings
brief banks
standard letters
client communication templates
redline playbooks
settlement agreement templates
intake checklists
practice-area checklists
internal policies
preferred drafting conventions
attorney-approved language
prior successful filings
```

This corpus should be highly permissioned and privilege-aware.

**JanumiLegal use:**

```text
Firm-style drafting
Client communication generation
Court filing draft generation
Redline workflows
Practice-area lens customization
Attorney review packet standards
```

For a platform product, this should be modeled as a **Firm Knowledge Profile**, not hardcoded into any one customer deployment.

---

## 7. Practice-area lens packs

These are not exactly “RAG sources” in the ordinary sense, but JanumiLegal will need them in retrieval or configuration form because they define workflow behavior.

Minimum lens-pack sources:

```text
lens definitions
state-machine definitions
state prompt templates
issue taxonomies
required source checklists
artifact templates
review policies
release policies
jurisdiction profiles
practice-area playbooks
```

**JanumiLegal use:**

```text
Lens Classifier
State Machine Runtime
Issue Bloom Agent
Issue Prune Agent
Release Gate Evaluator
Attorney Review Packet Agent
```

For example, a Family Law Production Lens Pack might retrieve:

```text
custody enforcement issue taxonomy
custody modification issue taxonomy
protective order issue taxonomy
required document checklist
client advice template
motion drafting template
release policy
```

This is part of the product’s “legal operating system,” not just background knowledge.

---

# Minimal MVP corpus for a first Maryland litigation/family-law pilot

For a practical first JanumiLegal MVP, I would not try to cover all U.S. law.

I would start with this minimum:

```text
1. Maryland statutes and rules relevant to family law, criminal defense, and civil litigation
2. Maryland court forms and filing instructions
3. Maryland appellate decisions
4. Federal law and federal rules for matters that cross into federal practice
5. CourtListener / RECAP for federal dockets, filings, and opinions
6. Matter-specific uploaded documents
7. Firm templates, checklists, and attorney-approved exemplars
8. Lens-pack definitions and firm review/release policies
```

That is enough to support:

```text
Family Law Production Lens
Criminal Defense Production Lens
Civil Litigation Intake/Production Lens
Legal Research Memo Lens
Court Filing Draft Lens
Client Advice Draft Lens
Authority Verification Lens
Redline Lens
```

---

# Source priority by JanumiLegal capability

| Capability               | Minimum RAG sources                                                   |
| ------------------------ | --------------------------------------------------------------------- |
| Legal research memo      | statutes, rules, cases, agency guidance, firm memos                   |
| Direct legal conclusion  | matter docs, statutes/rules, cases, firm playbook                     |
| Court filing draft       | matter docs, court forms, local rules, prior approved filings         |
| Client advice draft      | matter docs, attorney-approved templates, public law, firm policy     |
| Redlines                 | target document, firm playbook, clause library, prior agreements      |
| Client chat              | matter record, approved response templates, firm communication policy |
| Authority verification   | official law sources, case law corpus, citation tools, source spans   |
| Release gates            | firm policies, artifact type, review status, privilege labels         |
| Issue bloom/prune        | lens issue taxonomy, matter type, practice-area checklist             |
| Timeline/fact extraction | uploaded matter docs, emails/texts, dockets, court orders             |

---

# What not to rely on as primary RAG sources

Avoid treating these as authoritative primary sources:

```text
random law firm blog posts
consumer legal self-help sites
Wikipedia
general web snippets
AI-generated summaries
unverified legal newsletters
non-official reposts of statutes
outdated PDFs with no effective-date metadata
```

These may be useful as secondary orientation, but JanumiLegal should label them accordingly.

---

# Necessary source metadata

Every retrieved item should carry legal-source metadata. Minimal fields:

```ts
type LegalSourceMetadata = {
  sourceId: string;
  sourceType:
    | "statute"
    | "regulation"
    | "rule"
    | "case_law"
    | "court_form"
    | "local_rule"
    | "agency_guidance"
    | "matter_document"
    | "firm_template"
    | "firm_memo"
    | "secondary_source";

  jurisdiction?: string;
  court?: string;
  agency?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  publicationDate?: string;
  authorityLevel:
    | "binding"
    | "persuasive"
    | "matter_specific"
    | "firm_internal"
    | "secondary"
    | "unknown";

  sourceUrl?: string;
  licenseOrAccess?: string;
  retrievedAt: string;
  citation?: string;
  version?: string;
  privilegeStatus?: string;
  confidentialityLevel?: string;
};
```

Without this metadata, the system cannot safely label source quality, staleness, jurisdiction, privilege, or release status.

---

# The RAG architecture should be multi-index, not one index

I would separate retrieval into at least these indexes:

```text
1. Public Primary Law Index
   statutes, rules, regulations

2. Case Law Index
   federal/state opinions

3. Court Procedure Index
   court forms, local rules, filing instructions

4. Matter Source Index
   uploaded/client/case-specific documents

5. Firm Knowledge Index
   templates, prior work product, checklists, playbooks

6. Lens Configuration Index
   state machines, prompt templates, issue taxonomies, artifact contracts

7. Authority Verification Index
   citation/source-span store, quote match, case treatment data if available
```

The retrieval pipeline should know which index it is searching. A filing-draft state should not retrieve from the same corpus as a client-advice tone transformation state.

---

# Bottom line

The **minimal RAG data sources** for JanumiLegal are:

```text
Federal statutes, regulations, rules, and Federal Register materials
State statutes, regulations, rules, forms, and local court procedures
Federal and state court decisions
Federal dockets/filings through CourtListener/RECAP where applicable
Matter-specific client and case documents
Firm-specific templates, playbooks, prior work product, and checklists
Lens-pack definitions, issue taxonomies, review policies, and artifact templates
```

The most important design point is:

> **JanumiLegal should retrieve from typed legal source layers, not a generic legal knowledge pile.**

That enables the system to say:

```text
This fact came from a client document.
This rule came from a statute.
This proposed filing section came from a court form template.
This drafting style came from firm precedent.
This legal support is machine-assessed and needs attorney confirmation.
```

That typed separation is what makes RAG compatible with JanumiLegal’s lens/state-machine governance model.

[1]: https://www.govinfo.gov/help/uscode?utm_source=chatgpt.com "United States Code | GovInfo"
[2]: https://www.govinfo.gov/help/cfr?utm_source=chatgpt.com "Code of Federal Regulations | GovInfo"
[3]: https://www.govinfo.gov/help/fr?utm_source=chatgpt.com "Federal Register | GovInfo"
[4]: https://free.law/projects/courtlistener/?utm_source=chatgpt.com "CourtListener Research and Awareness Website | Free Law Project | Making the legal ecosystem more equitable and competitive."
[5]: https://www.courtlistener.com/help/api/rest/recap/?utm_source=chatgpt.com "RECAP APIs for PACER Data – CourtListener.com"
