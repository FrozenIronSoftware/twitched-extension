.PHONY: all clean chrome

all:
	$(MAKE) -C chrome all

clean:
	$(MAKE) -C chrome clean

chrome:
	$(MAKE) -C chrome chrome