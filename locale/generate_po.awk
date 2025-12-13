#!/usr/bin/awk -f
BEGIN{	gen_output="po_files";print > gen_output;"mkdir eduhoot"|getline}
{
	if ( $0 ~ /i18n={/ ) a=1;
	if ( a >=1 ) 
	{ 
		if ($0 ~ /.*\".*:.*\".*/ )
		{
			patsplit($0,msgid,"\".*\"\ ?:\ ?\"",seps);
			sub(/:\ ?\"$/,"",msgid[1]);
			if ( a== 1 )
			{
				print "msgid "msgid[1] >> output;
				print "msgstr \"\"\n" >> output;
			}
			if ( a == 2 )
			{
				print "msgid "msgid[1] >> output;
				patsplit($0,msgstr,"\".*\"\ ?:\ ?\"",seps);
				sub(/\",?$/,"",seps[1]);
				print "msgstr \""seps[1]"\"\n" >> output;
			}
		} else {
			if ( $0 ~ "\"..\":" )
			{
				if ( $0 !~ "\"en\":" ){
					if ( $0 ~ "\"es\":" )
					{
						a=2;
					} else {
						a=0;
					}
				}else{
					a=1;
				}
			} else {
				if ( $0 ~ /\"[a-zA-Z0-9_]*\"/ && a>=1)
				{
						split($0,fname,"\"");
					if ( a==1 )
					{
						"mkdir eduhoot/"fname[2]|getline;
						output="eduhoot/"fname[2]"/"fname[2]".pot";
						lang="";
						fuzz="#, fuzzy"
					} else {
						lang="es_ES";
						fuzz=""
						output="eduhoot/"fname[2]"/es_ES.po";
					}
					print "OUTPUT: "output >> gen_output
					print "# SOME DESCRIPTIVE TITLE.\n# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER\n# This file is distributed under the same license as the PACKAGE package.\n# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.\n#\n"fuzz"\nmsgid \"\"\nmsgstr \"\"\n\"Project-Id-Version: PACKAGE VERSION\\n\"\n\"Report-Msgid-Bugs-To: \\n\"\n\"POT-Creation-Date: 2020-02-03 11:46+0100\\n\"\n\"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n\"\n\"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n\"\n\"Language-Team: LANGUAGE <LL@li.org>\\n\"\n\"Language: "lang"\\n\"\n\"MIME-Version: 1.0\\n\"\n\"Content-Type: text/plain; charset=CHARSET\\n\"\n\"Content-Transfer-Encoding: 8bit\\n\"" > output

				}
			}
		}
	} 
	if ( $0 ~ /};$/ ) a=0 
} 
