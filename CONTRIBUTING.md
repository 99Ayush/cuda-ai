# Contributing

This repository is primarily a personal project, but issues and pull requests are welcome.

## Before you open a pull request

1. **Open an issue first** for anything larger than a typo or a small fix, so the approach can be agreed before you spend time on it.
2. **Keep the change focused.** One concern per pull request beats a large mixed bag.
3. **Match the surrounding style.** Existing naming, module boundaries and error handling are deliberate.
4. **Run the checks** that apply to this repository:

   `ash
   npm run check
   `

## Commit messages

Use conventional prefixes: eat:, ix:, docs:, 	est:, efactor:, chore:.

## What I will not merge

- secrets, API keys or credentials of any kind
- generated build output (dist/, uild/)
- changes that remove tests to make a build pass
- vendor code without a licence that permits it

## Security

Never report a vulnerability in a public issue - see [SECURITY.md](SECURITY.md).