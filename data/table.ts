import { db } from "..";

export abstract class DBTable<
  TCreateProps extends object,
  TPayload extends object
> {
  abstract tableName: string;

  constructor() {}

  lastRowId() {
    return db.do("lastRowId", undefined);
  }

  async getRow(id: number) {
    return (await db.do("getRow", {
      id,
      tableName: this.tableName,
    })) as TPayload;
  }

  async createRow(props: TCreateProps) {
    return (await db.do("createRow", {
      tableName: this.tableName,
      props,
    })) as TPayload;
  }

  async allRows() {
    return (await db.do("allRows", {
      tableName: this.tableName,
    })) as TPayload[];
  }

  async where(props: Partial<TPayload>) {
    return (await db.do("where", {
      tableName: this.tableName,
      props,
    })) as TPayload[];
  }

  async updateRow(id: number, props: Partial<TPayload>) {
    return (await db.do("updateRow", {
      id,
      tableName: this.tableName,
      props,
    })) as TPayload;
  }

  deleteRow(id: number) {
    return db.do("deleteRow", {
      id,
      tableName: this.tableName,
    });
  }

  rawQuery(query: string) {
    return db.do("rawQuery", {
      query,
    });
  }
}
