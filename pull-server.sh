#!/bin/bash
# npm run build
git add .

echo "Mensagem do commit: "
read message
git commit -am "$message"
# git push
git push --force origin main
# ssh 35.198.35.159 \
#   'git -C /home/mauriciohbcorrea/checklist/checkfront/app ' \
#   'pull origin master && '