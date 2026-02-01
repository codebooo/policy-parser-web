# Policy Keyword Analysis Report

Generated: 2025-12-01T20:34:30.987Z

## Summary

- **Documents Analyzed**: 22
- **Unique Words Found**: 1706
- **Unique Bigrams Found**: 909
- **Policy Keywords Identified**: 35
  - High Confidence: 21
  - Medium Confidence: 14
  - Low Confidence: 0

## High Confidence Policy Keywords

These terms are strongly associated with privacy policies:

| Term | Frequency | Documents | Score |
|------|-----------|-----------|-------|
| information | 1224 | 18/22 | 0.909 |
| data | 1175 | 18/22 | 0.909 |
| consent | 159 | 17/22 | 0.886 |
| privacy | 464 | 16/22 | 0.864 |
| cookies | 347 | 16/22 | 0.864 |
| personal | 698 | 15/22 | 0.841 |
| rights | 215 | 15/22 | 0.841 |
| access | 250 | 14/22 | 0.818 |
| legal | 194 | 14/22 | 0.818 |
| law | 181 | 14/22 | 0.818 |
| party | 103 | 14/22 | 0.818 |
| laws | 98 | 14/22 | 0.808 |
| collect | 193 | 13/22 | 0.795 |
| security | 153 | 13/22 | 0.795 |
| third-party | 114 | 12/22 | 0.773 |
| protection | 103 | 12/22 | 0.773 |
| com | 87 | 13/22 | 0.730 |
| collected | 79 | 12/22 | 0.668 |
| protect | 77 | 12/22 | 0.658 |
| control | 61 | 13/22 | 0.600 |
| delete | 61 | 13/22 | 0.600 |

## Medium Confidence Policy Keywords

| Term | Frequency | Documents | Score |
|------|-----------|-----------|-------|
| share | 143 | 11/22 | 0.750 |
| processing | 194 | 10/22 | 0.727 |
| cookie | 73 | 11/22 | 0.615 |
| art | 180 | 5/22 | 0.614 |
| informationen | 135 | 5/22 | 0.614 |
| compliance | 50 | 10/22 | 0.477 |
| shared | 37 | 11/22 | 0.435 |
| jurisdiction | 37 | 11/22 | 0.435 |
| collection | 41 | 10/22 | 0.432 |
| tracking | 36 | 11/22 | 0.430 |
| controller | 44 | 8/22 | 0.402 |
| copyright | 48 | 7/22 | 0.399 |
| retention | 37 | 9/22 | 0.390 |
| personalized | 41 | 8/22 | 0.387 |

## Top Raw Word Frequencies (Before AI Filtering)

| Word | Count | Documents |
|------|-------|-----------|
| information | 1224 | 18 |
| data | 1175 | 18 |
| personal | 698 | 15 |
| daten | 502 | 5 |
| privacy | 464 | 16 |
| cookies | 347 | 16 |
| provide | 304 | 15 |
| access | 250 | 14 |
| rights | 215 | 15 |
| processing | 194 | 10 |
| legal | 194 | 14 |
| collect | 193 | 13 |
| law | 181 | 14 |
| art | 180 | 5 |
| consent | 159 | 17 |
| parties | 158 | 14 |
| contact | 157 | 13 |
| security | 153 | 13 |
| zur | 153 | 5 |
| address | 152 | 13 |
| payment | 151 | 12 |
| applicable | 150 | 14 |
| advertising | 146 | 14 |
| nicht | 145 | 5 |
| share | 143 | 11 |
| please | 138 | 12 |
| informationen | 135 | 5 |
| request | 125 | 12 |
| like | 124 | 14 |
| third-party | 114 | 12 |
| name | 113 | 17 |
| agree | 111 | 11 |
| others | 108 | 13 |
| provided | 107 | 13 |
| ads | 104 | 10 |
| order | 103 | 14 |
| party | 103 | 14 |
| protection | 103 | 12 |
| affiliates | 98 | 14 |
| laws | 98 | 14 |
| limited | 98 | 18 |
| verarbeitung | 96 | 5 |
| based | 93 | 12 |
| nutzung | 93 | 5 |
| einwilligung | 93 | 5 |
| technologies | 91 | 10 |
| personenbezogenen | 91 | 5 |
| responsible | 89 | 10 |
| com | 87 | 13 |
| receive | 85 | 13 |

## Top Bigram Frequencies

| Phrase | Count | Documents |
|--------|-------|-----------|
| personal data | 440 | 10 |
| personal information | 207 | 13 |
| personenbezogenen daten | 91 | 5 |
| data protection | 75 | 9 |
| window tab | 63 | 1 |
| applicable law | 60 | 12 |
| data privacy | 57 | 7 |
| privacy framework | 41 | 6 |
| intellectual property | 38 | 7 |
| information collect | 36 | 7 |
| legitimate interest | 33 | 3 |
| processing based | 31 | 4 |
| legal obligations | 29 | 9 |
| legitimate interests | 27 | 5 |
| credit card | 26 | 8 |
| personenbezogene daten | 26 | 5 |
| social media | 26 | 10 |
| data collect | 26 | 7 |
| personenbezogener daten | 23 | 4 |
| contact information | 23 | 6 |
| collect information | 22 | 7 |
| privacy rights | 22 | 6 |
| sole discretion | 22 | 5 |
| nutzer innen | 20 | 2 |
| data collected | 20 | 5 |
| location data | 20 | 3 |
| permitted applicable | 20 | 3 |
| property rights | 19 | 6 |
| share personal | 18 | 7 |
| law enforcement | 18 | 8 |

## Usage in PolicyParser

To use these keywords for policy detection, add them to the discovery engine:

```typescript
const POLICY_DETECTION_KEYWORDS = [
    'information',
    'data',
    'consent',
    'privacy',
    'cookies',
    'personal',
    'rights',
    'access',
    'legal',
    'law',
    'party',
    'laws',
    'collect',
    'security',
    'third-party',
    'protection',
    'com',
    'collected',
    'protect',
    'control',
    'delete',
];
```
