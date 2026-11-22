# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's
[private vulnerability reporting](https://github.com/99Ayush/verity/security/advisories/new)
so the report stays private until a fix is ready.

A useful report includes:

- the affected commit or version
- reproduction steps
- the impact you observed
- any suggested mitigation

I aim to acknowledge reports within 72 hours.

## Scope and expectations

Verity processes claim text through third-party providers (Gemini, Tavily) with server-side keys. Provider credentials must never be committed or exposed to the browser.

## Supported versions

The main branch is the supported version. Older commits are not patched.