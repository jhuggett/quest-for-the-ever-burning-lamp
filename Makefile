.PHONY: build-darwin-arm64
build-darwin-arm64:
	echo "Building the project..."; \
	bun build ./index.ts --target=bun-darwin-arm64 --compile --outfile ./dist/darwin-arm64/game; \
	cp ./manual.txt ./dist/darwin-arm64/manual.txt; \
	zip -j ./dist/darwin-arm64.zip ./dist/darwin-arm64/* -x "*.DS_Store"; \

.PHONY: build-darwin-x64
build-darwin-x64:
	echo "Building the project..."; \
	bun build ./index.ts --target=bun-darwin-x64 --compile --outfile ./dist/darwin-x64/game; \
	cp ./manual.txt ./dist/darwin-x64/manual.txt; \
	zip -j ./dist/darwin-x64.zip ./dist/darwin-x64/* -x "*.DS_Store"; \

.PHONY: build-windows-x64
build-windows-x64:
	echo "Building the project..."; \
	bun build ./index.ts --target=bun-windows-x64 --compile --outfile ./dist/windows-x64/game; \
	cp ./manual.txt ./dist/windows-x64/manual.txt; \
	zip -j ./dist/windows-x64.zip ./dist/windows-x64/* -x "*.DS_Store"; \


.PHONY: build-all
build-all: build-darwin-arm64 build-darwin-x64 build-windows-x64
	echo "Build completed!"; \