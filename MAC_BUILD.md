# Build Allus Focus para macOS

## Status atual
✅ Configuração de build pronta (MakerDMG, entitlements, Info.plist)
✅ GitHub Actions builda e publica o `.dmg` automaticamente (`.github/workflows/build-mac.yml`)
⚠️ O disparo automático (push de tag `v*`) pode falhar silenciosamente se a tag
   for criada no mesmo commit de uma mudança grande no repo (ex.: rename do
   repositório) — foi o que aconteceu com a v3.0.6, que saiu sem `.dmg` na
   release. Nesses casos, dispare manualmente (ver abaixo) que ele publica
   certinho na release já existente.

## CI/CD (GitHub Actions)

`.github/workflows/build-mac.yml` builda em runner `macos-latest` e publica o
`.dmg` direto na release do GitHub (via `PublisherGithub`, usa a versão do
`package.json` pra achar/criar a release — não depende de qual ref disparou
o run). Funciona normalmente desde a v3.0.0.

Se uma tag nova não disparar o build sozinha, dispare à mão:
**Actions → Build macOS → Run workflow** (branch `master`).

## Como buildar no macOS localmente (alternativa)

Precisa de alguém com um Mac (Pedro tem Apple Silicon M-series). Ver
`Allus-Clock-Build-Mac.pdf` na raiz do repo pra instruções passo a passo
prontas pra encaminhar.

Resumo do processo:
```bash
git clone https://github.com/Rumy-dev/Allus-Focus.git
cd Allus-Focus
npm install
npm run make
```
Gera o `.dmg` não assinado em:
- `out/make/dmg/arm64/Allus Focus.dmg` — Apple Silicon (M1/M2/M3...)
- `out/make/dmg/x64/Allus Focus.dmg` — Intel

## Publicando uma nova versão

1. Bump de versão em `package.json`
2. Criar tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
3. Conferir se `build-mac.yml` e `build-windows.yml` rodaram (Actions) e
   publicaram os assets na release `vX.Y.Z`. Se não rodaram sozinhos, disparar
   manualmente via `workflow_dispatch` (Actions → Run workflow).

## Distribuição pros usuários finais

Como não temos Developer ID Apple ($99/ano), o `.dmg` não é assinado.
Na primeira abertura, o macOS mostra "desenvolvedor não identificado":
- Contorno: clicar com **botão direito** no app → **Abrir** → confirmar
  "Abrir mesmo assim" (só necessário uma vez)

Link de download da versão mais recente sempre fica em:
**https://github.com/Rumy-dev/Allus-Focus/releases**

## Quando tiver certificado Apple (futuro)

Se adicionar Developer ID Certificate para code signing, em `forge.config.ts`:
```typescript
osxSign: {
  identity: 'Developer ID Application: Nome (XXXXX)',
  hardenedRuntime: true,
  optionsForFile: () => ({ entitlements: 'assets/entitlements.plist' }),
},
osxNotarize: {
  teamId: 'XXXXX',
}
```
Isso elimina o aviso do Gatekeeper e permite habilitar o GitHub Actions
pra assinar + notarizar automaticamente também.

## Arquivos relevantes
- `forge.config.ts` — MakerDMG, osxSign, entitlements
- `assets/entitlements.plist` — permissões do app (tray, notificações, arquivos)
- `assets/info.plist` — configurações macOS (Info.plist estendido)
- `.github/workflows/build-mac.yml` — pronto, aguardando liberação da conta
- `Allus-Clock-Build-Mac.pdf` — instruções pra quem for gerar o build
