export namespace main {
	
	export class ConnectionHistory {
	    host: string;
	    port: number;
	    user: string;
	    keyFile: string;
	    endpoint: string;
	    jumpHosts: string[];
	    localForwarderType: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new ConnectionHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.keyFile = source["keyFile"];
	        this.endpoint = source["endpoint"];
	        this.jumpHosts = source["jumpHosts"];
	        this.localForwarderType = source["localForwarderType"];
	        this.timestamp = source["timestamp"];
	    }
	}

}

export namespace ovsdb {
	
	export class BaseType {
	    Type: string;
	    Enum: any[];
	
	    static createFrom(source: any = {}) {
	        return new BaseType(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Type = source["Type"];
	        this.Enum = source["Enum"];
	    }
	}
	export class ColumnType {
	    Key?: BaseType;
	    Value?: BaseType;
	
	    static createFrom(source: any = {}) {
	        return new ColumnType(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Key = this.convertValues(source["Key"], BaseType);
	        this.Value = this.convertValues(source["Value"], BaseType);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ColumnSchema {
	    Type: string;
	    TypeObj?: ColumnType;
	
	    static createFrom(source: any = {}) {
	        return new ColumnSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Type = source["Type"];
	        this.TypeObj = this.convertValues(source["TypeObj"], ColumnType);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TableSchema {
	    columns: Record<string, ColumnSchema>;
	    indexes?: string[][];
	    isRoot?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TableSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], ColumnSchema, true);
	        this.indexes = source["indexes"];
	        this.isRoot = source["isRoot"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DatabaseSchema {
	    name: string;
	    version: string;
	    tables: Record<string, TableSchema>;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseSchema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.tables = this.convertValues(source["tables"], TableSchema, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class OVSDBClient {
	
	
	    static createFrom(source: any = {}) {
	        return new OVSDBClient(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

