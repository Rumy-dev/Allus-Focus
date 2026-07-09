Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\rumye\OneDrive\Desktop\Allus Clock"
WshShell.Run "cmd /c npm start", 0, False
