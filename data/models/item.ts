import Database from "bun:sqlite";
import { DBTable } from "../table";

export type ItemType = "oil" | "breadcrumb" | "everlasting lamp";

export type ItemProps = {
  id: number;
  item_type: ItemType;
  tile_id: number;
};

export type CreateItemProps = Omit<ItemProps, "id" | "created_at">;

class ItemsTable extends DBTable<CreateItemProps, ItemProps> {
  tableName = "items";
}

export class Item {
  static table = new ItemsTable();

  props: ItemProps;
  constructor(props: ItemProps) {
    this.props = {
      id: props.id,
      item_type: props.item_type,
      tile_id: props.tile_id,
    };
  }

  static async create(payload: CreateItemProps) {
    const row = await Item.table.createRow(payload);

    if (row === null) throw new Error("Could not find created Item");

    return new Item(row);
  }

  static async find(id: number) {
    const row = await Item.table.getRow(id);
    return new Item(row as ItemProps);
  }

  static async all() {
    const rows = await Item.table.allRows();
    return rows.map((row) => new Item(row as ItemProps));
  }

  save() {
    return Item.table.updateRow(this.props.id, this.props);
  }

  delete() {
    return Item.table.deleteRow(this.props.id);
  }

  variant = Math.random();
}
