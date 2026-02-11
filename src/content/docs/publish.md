---
title: Publishing apps
weight: 10
---

Use `zsp` to publish apps.

For most users, the fastest path is the interactive wizard:

```bash
zsp publish --wizard
```

The wizard guides you through source selection, metadata, signing, and publish, so you usually do not need to write config by hand.

## Install

```bash
go install github.com/zapstore/zsp@latest
```

Or download a binary from the [zsp releases page](https://github.com/zapstore/zsp/releases).

## Non-wizard quick path

If you already know your source, you can publish directly:

```bash
zsp publish -r github.com/your-org/your-app
```

For all flags and advanced usage, see the [`zsp` README](https://github.com/zapstore/zsp).