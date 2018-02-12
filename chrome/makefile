.PHONY: all chrome init clean

all: chrome

init:
	mkdir -p ../out

clean:
	rm -rf ../out

chrome: init
	rm -f ../out/chrome.zip && \
	zip -r ../out/chrome.zip ./* -x Chrome.iml makefile

