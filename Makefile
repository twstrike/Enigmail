# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

XPI_MODULE	= enigmail
XPI_MODULE_VERS = 1.9

DEPTH		= .

include $(DEPTH)/config/autoconf.mk

DIRS = ipc public

DIRS += ui package lang

ifeq ($(TESTS),yes)
DIRS += check
endif

XPIFILE = $(XPI_MODULE)-$(XPI_MODULE_VERS).xpi

.PHONY: dirs $(DIRS)

all: dirs xpi

dirs: $(DIRS)

$(DIRS):
	$(MAKE) -C $@

xpi:
	$(srcdir)/util/genxpi $(XPIFILE) $(XPI_MODULE_VERS) $(DIST) $(srcdir) $(XPI_MODULE) $(ENABLE_LANG)

check:
	util/checkFiles.py

jshint:
	static_analysis/jshint ipc
	static_analysis/jshint package
	static_analysis/jshint ui

clean:
	rm -f build/$(XPIFILE)
	for dir in $(DIRS); do \
		if [ "$${dir}x" != "checkx" ]; then \
		$(MAKE) -C $$dir clean; fi; \
	done

distclean: clean
	rm -rf build/*
	rm -f config/autoconf.mk config.log config.status
