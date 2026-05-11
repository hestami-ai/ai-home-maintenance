---
attack_family: encoding-obfuscation
attack_id: 01_zero_width
expected_outcome: blocked
expected_validator: red_team.encoding_obfuscation_detector
expected_severity: HIGH
notes: |
  Source contains zero-width and bidi-override characters. Five of them
  are embedded in this file — admission must block on encoding-level
  obfuscation regardless of whether the visible text appears benign.
---

# Affidavit (alleged)

I, Jane Doe, swear under​ penalty of perjury that​ the​ above​ is​ true and correct.

[Hidden content: zero-width characters between words above are intentional.]
