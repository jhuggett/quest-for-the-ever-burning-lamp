import Database from "bun:sqlite";
import { DBTable } from "../table";

export type ItemType = "oil" | "breadcrumb" | "everlasting lamp";

type ItemProps = {
  id: number;
  item_type: ItemType;
  tile_id: number;
};

export type CreateItemProps = Omit<ItemProps, "id" | "created_at">;

class ItemsTable extends DBTable<CreateItemProps, ItemProps> {
  tableName = "items";
}

export class Item {
  static table(db: Database) {
    return new ItemsTable(db);
  }

  constructor(public props: ItemProps) {}

  Item(db: Database) {
    Item.table(db).updateRow(this.props.id, this.props);
  }

  static create(db: Database, payload: CreateItemProps) {
    const row = Item.table(db).createRow(payload);

    if (row === null) throw new Error("Could not find created Item");

    return new Item(row);
  }

  static find(db: Database, id: number) {
    const row = Item.table(db).getRow(id);
    return new Item(row as ItemProps);
  }

  static all(db: Database) {
    const rows = Item.table(db).allRows();
    return rows.map((row) => new Item(row as ItemProps));
  }

  save(db: Database) {
    Item.table(db).updateRow(this.props.id, this.props);
  }

  delete(db: Database) {
    Item.table(db).deleteRow(this.props.id);
  }

  variant = Math.random();
}
