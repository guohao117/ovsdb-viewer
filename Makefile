<file_path>
ovsdb-viewer\Makefile
</file_path>

<edit_description>
Create Makefile with code-gen target
</edit_description>

.PHONY: code-gen

code-gen:
	go generate ./internal/ovsdb
