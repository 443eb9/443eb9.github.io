# Island content

Use Node.js 22.18 or later. Source documents and attachments belong under `.content/islands/islands`. Fetch the full `/islands/` tree from `443eb9/islands`. Relative attachment URLs resolve from the document directory. Each titled document uses a unique positive-integer source directory. Its public route contains that directory number, such as `/island/39` for `39/tenten-13.md`. Source identifiers and encryption contexts retain the full relative Markdown path.

Run `npm run build` to validate references and create the site. A missing attachment, invalid encryption marker, or shared public/private attachment stops publication. Content generation clears previous generated content, published attachments, and `dist` before validation.

## Encryption

Set `encrypted = true` in TOML frontmatter, or `encrypted: true` in YAML, to encrypt the complete Markdown body and its directory's attachments. Title, description, tags, and date remain public.

For partial encryption, surround complete Markdown blocks with these markers:

```markdown
Public text.

<!-- BEGIN ENCRYPT -->
Private text and local attachment references.
<!-- END ENCRYPT -->

Public text.
```

The generated body retains the markers and replaces each protected section with Base64 ciphertext. The browser displays ciphertext as text. The key-entry interface is reserved for a later implementation.

`ISLAND_ENCRYPTION_KEY` holds a Base64-encoded random 32-byte key. Store it in the ignored `.env.local` for local builds and the same named Actions Secret for deployment. Keep the key available privately for future decryption and backups. The browser bundle receives ciphertext only for protected content. Vite blocks requests to `.content` and environment files.

Each binary ciphertext uses this format:

1. UTF-8 bytes `ISLAND-AES-GCM` followed by byte `0x01`.
2. Random 12-byte IV.
3. AES-256-GCM ciphertext.
4. 16-byte authentication tag.

Markdown ciphertext is Base64-encoded. Attachment ciphertext is binary, stored at the original relative path with `.enc` appended. AES-GCM additional authenticated data is the UTF-8 encoding of:

- Whole body: `island:{document-id}`.
- Marked section: `island:{document-id}:section:{index}`, starting at zero among protected sections.
- Attachment: `asset:{path-relative-to-content-root}`.

The DOM exposes each Markdown ciphertext's authenticated-data string through `data-encryption-context`. Decryption should authenticate the tag and context before displaying content. Public references to protected attachments require separate public copies.
