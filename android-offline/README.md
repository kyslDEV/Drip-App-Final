# DripTest APK

Este projeto Android empacota o DripTest dentro de um APK nativo.

O app deve abrir pela tela de login:

```text
file:///android_asset/www/login.html
```

Assim, a operacao principal nao depende de rede, servidor, cache do navegador ou PWA.

## Gerar APK pelo Android Studio

1. Abra o Android Studio.
2. Escolha `Open`.
3. Selecione a pasta `android-offline`.
4. Aguarde o Sync do Gradle.
5. Use `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
6. O APK de debug fica em:

```text
android-offline/app/build/outputs/apk/debug/app-debug.apk
```

## Atualizar os arquivos web dentro do APK

Sempre que alterar as telas web, copie novamente estes arquivos para:

```text
android-offline/app/src/main/assets/www/
```

Arquivos principais:

- `index.html`
- `login.html`
- `DripTeste.html`
- `DripTestF.html`
- `DripSchedule.html`
- `DripReports.html`
- `DripAbsorption.html`
- `drip-data.js`
- `drip-theme.css`
- `drip-ui.js`
- `service-worker.js`
- `manifest.webmanifest`
- `icons/`

Depois gere um novo APK.

Ou rode:

```powershell
.\sync-web-assets.ps1
```
