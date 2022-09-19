const inputElement = document.getElementById("input");
const raportElement = document.getElementById("raport");

function hasGzipHeader(data) {
    var head = new Uint8Array(data.slice(0, 2));
    return head.length === 2 && head[0] === 0x1f && head[1] === 0x8b;
}
function nbt2obj(tag) {
    switch (tag.type) {
        case 'byte':
        case 'short':
        case 'int':
        case 'long':
        case 'float':
        case 'double':
        case 'string':
        case 'byteArray':
        case 'intArray':
        case 'longArray':
            return tag.value;
        case 'list':
            const list = [];
            for (let i = 0; i < tag.value.value.length; i++) {
                list.push(nbt2obj({
                    type: tag.value.type,
                    value: tag.value.value[i]
                }));
            }
            return list;
        case 'compound':
            const obj = {};
            for (const key in tag.value) {
                obj[key] = nbt2obj(tag.value[key]);
            }
            return obj;
        default:
            throw new Error(`Unknown tag type: ${tag.type}`);
    }
}
function pushItem(items, item, desc) {
    if (item.id === undefined) {
        return;
    }
    item.Slot = undefined;
    let id = String(item["id"]);
    if (items[id] === undefined) {
        items[id] = {};
    }
    let it = JSON.stringify(item);
    if (items[id][it] === undefined) {
        items[id][it] = [];
    }
    items[id][it].push(desc);
}
function textLI(text) {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(text));
    return li;
}
function createUL(items) {
    const ul = document.createElement("ul");
    for (const id in items) {
        const li = textLI(id);
        const ul2 = document.createElement("ul");
        for (const item in items[id]) {
            const li2 = textLI(item);
            const ul3 = document.createElement("ul");
            for (let i = 0; i < items[id][item].length; i++) {
                const li3 = textLI(items[id][item][i]);
                ul3.appendChild(li3);
            }
            li2.appendChild(ul3);
            ul2.appendChild(li2);
        }
        li.appendChild(ul2);
        ul.appendChild(li);
    }
    return ul;
}
function handleFiles() {
    const fileList = this.files;
    const numFiles = fileList.length;
    while (raportElement.firstChild) {
        raportElement.firstChild.remove()
    }
    for (let i = 0; i < numFiles; i++) {
        const file = fileList[i];
        const reader = new FileReader();
        reader.onerror = function (e) {
            const div = document.createElement("div");
            div.textContent = `Error reading file ${file.name}: ${reader.error}`;
            raportElement.appendChild(div);
        };
        reader.onload = function (e) {
            try {
                let data = new Uint8Array(reader.result);
                if (hasGzipHeader(reader.result)) {
                    data = pako.inflate(new Uint8Array(data));
                }
                const tileItems = {};
                const entityItems = {};
                let tag = nbt.parseUncompressed(data);
                tag.value.Blocks = {type: "byteArray"};
                tag.value.Data = {type: "byteArray"};
                tag = nbt2obj({
                    type: 'compound',
                    value: tag.value
                });
                const tileEntities = tag["TileEntities"];
                const entities = tag["Entities"];
                if (tileEntities) {
                    for (let i = 0; i < tileEntities.length; i++) {
                        const tile = tileEntities[i];
                        if (tile["Items"]) {
                            const inv = tile["Items"];
                            for (let j = 0; j < inv.length; j++) {
                                pushItem(tileItems, inv[j], tile.id + ": /tppos " + (tile.x + tag.WEOriginX) + " " + (tile.y + tag.WEOriginY) + " " + (tile.z + tag.WEOriginZ));
                            }
                        }
                    }
                }
                if (entities) {
                    for (let i = 0; i < entities.length; i++) {
                        const entity = entities[i];
                        let posX = Math.round(entity.Pos[0] * 10) / 10;
                        let posY = Math.round(entity.Pos[1] * 10) / 10;
                        let posZ = Math.round(entity.Pos[2] * 10) / 10;
                        if (entity["Item"]) {
                            const item = entity["Item"];
                            pushItem(entityItems, item, entity.id + ": /tppos " + posX + " " + posY + " " + posZ);
                        }
                        if (entity["Equipment"]) {
                            const inv = entity["Equipment"];
                            for (let j = 0; j < inv.length; j++) {
                                pushItem(entityItems, inv[j], entity.id + ": /tppos " + posX + " " + posY + " " + posZ);
                            }
                        }
                    }
                }
                console.log(tag);
                const ul = document.createElement("ul");
                ul.appendChild(textLI(`File ${file.name}:`));
                ul.appendChild(textLI(`Schematic size: ${tag.Width}x${tag.Height}x${tag.Length}`));
                ul.appendChild(textLI(`TileEntities:`));
                ul.appendChild(createUL(tileItems));
                ul.appendChild(textLI(`Entities:`));
                ul.appendChild(createUL(entityItems));

                raportElement.appendChild(ul);
            } catch (e) {
                const div = document.createElement("div");
                div.textContent = `Error reading file ${file.name}: ${e}`;
                raportElement.appendChild(div);
            }
        };
        reader.readAsArrayBuffer(file);
    }
}
inputElement.addEventListener("change", handleFiles, false);