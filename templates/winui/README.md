# dynwinrt-jsx WinUI app

This project renders native WinUI 3 controls from strict TypeScript TSX.

```powershell
npm install
npm run setup
npm start
```

`main.js` bootstraps the Windows App SDK before starting the UI Worker. The Worker owns the STA, creates the WinUI `Application` and `Window`, and renders `src\winui-worker.tsx`.
