# Get running processes without ps command

for prc in /proc/*/cmdline; do (printf "$prc "; cat -A "$prc") | sed 's/\^@/ /g;s|/proc/||;s|/cmdline||'; echo; done
