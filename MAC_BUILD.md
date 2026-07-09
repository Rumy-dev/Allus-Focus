# Build Allus Focus para macOS

## Status atual
✅ Configuração de build pronta (MakerDMG, entitlements, Info.plist)
✅ v0.1.0 gerada localmente por Pedro (Mac Apple Silicon) e publicada em
   [GitHub Releases](https://github.com/Rumy-dev/allus-clock/releases)
⚠️ GitHub Actions **não funciona nesta conta** — ver seção abaixo

## Por que não usamos CI/CD (GitHub Actions)

Tentamos configurar `.github/workflows/build-mac.yml` pra buildar automaticamente
em runner macOS gratuito do GitHub, mas a conta usada pra criar o repositório
(`Rumy-dev`) é muito nova e o GitHub bloqueia silenciosamente o acesso a runners
macOS/Windows (que custam 10x mais que Linux) em contas recém-criadas, como
proteção antiabuso. Confirmado via API: um workflow idêntico rodando em
`ubuntu-latest` foi aceito normalmente; o mesmo com `runs-on: macos-latest`
nunca apareceu na lista de workflows, mesmo com o repositório público.

O arquivo `.github/workflows/build-mac.yml` continua no repositório — quando a
conta acumular mais tempo/atividade (ou você abrir chamado no suporte do
GitHub pedindo liberação), ele deve passar a funcionar sem precisar reconfigurar
nada. Pra testar se já foi liberado: **Actions → Build macOS → Run workflow**.

## Como buildar no macOS (processo atual — funciona)

Precisa de alguém com um Mac (Pedro tem Apple Silicon M-series). Ver
`Allus-Clock-Build-Mac.pdf` na raiz do repo pra instruções passo a passo
prontas pra encaminhar.

Resumo do processo:
```bash
git clone https://github.com/Rumy-dev/allus-clock.git
cd allus-clock
npm install
npm run make
```
Gera o `.dmg` não assinado em:
- `out/make/dmg/arm64/Allus Focus.dmg` — Apple Silicon (M1/M2/M3...)
- `out/make/dmg/x64/Allus Focus.dmg` — Intel

## Publicando uma nova versão

1. Bump de versão em `package.json`
2. Gerar o `.dmg` (processo acima)
3. Criar tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
4. Criar Release no GitHub e subir o `.dmg` como asset — via UI
   (`github.com/Rumy-dev/allus-clock/releases/new`) ou via API com um
   Personal Access Token (escopo `repo`)

## Distribuição pros usuários finais

Como não temos Developer ID Apple ($99/ano), o `.dmg` não é assinado.
Na primeira abertura, o macOS mostra "desenvolvedor não identificado":
- Contorno: clicar com **botão direito** no app → **Abrir** → confirmar
  "Abrir mesmo assim" (só necessário uma vez)

Link de download da versão mais recente sempre fica em:
**https://github.com/Rumy-dev/allus-clock/releases**

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
