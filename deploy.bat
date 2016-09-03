xcopy public vincentlauvlwj /e /y
xcopy statics vincentlauvlwj /e /y
cd vincentlauvlwj
git add .
git commit -a -m "autopush"
git push origin coding-pages:coding-pages
cd ..