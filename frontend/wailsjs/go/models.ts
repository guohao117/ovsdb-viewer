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
	
	export class OVSDBClient {
	
	
	    static createFrom(source: any = {}) {
	        return new OVSDBClient(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace vswitch {
	
	export class Bridge {
	    UUID: string;
	    AutoAttach?: string;
	    Controller: string[];
	    DatapathID?: string;
	    DatapathType: string;
	    DatapathVersion: string;
	    ExternalIDs: Record<string, string>;
	    FailMode?: string;
	    FloodVLANs: number[];
	    FlowTables: Record<number, string>;
	    IPFIX?: string;
	    McastSnoopingEnable: boolean;
	    Mirrors: string[];
	    Name: string;
	    Netflow?: string;
	    OtherConfig: Record<string, string>;
	    Ports: string[];
	    Protocols: string[];
	    RSTPEnable: boolean;
	    RSTPStatus: Record<string, string>;
	    Sflow?: string;
	    Status: Record<string, string>;
	    STPEnable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Bridge(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UUID = source["UUID"];
	        this.AutoAttach = source["AutoAttach"];
	        this.Controller = source["Controller"];
	        this.DatapathID = source["DatapathID"];
	        this.DatapathType = source["DatapathType"];
	        this.DatapathVersion = source["DatapathVersion"];
	        this.ExternalIDs = source["ExternalIDs"];
	        this.FailMode = source["FailMode"];
	        this.FloodVLANs = source["FloodVLANs"];
	        this.FlowTables = source["FlowTables"];
	        this.IPFIX = source["IPFIX"];
	        this.McastSnoopingEnable = source["McastSnoopingEnable"];
	        this.Mirrors = source["Mirrors"];
	        this.Name = source["Name"];
	        this.Netflow = source["Netflow"];
	        this.OtherConfig = source["OtherConfig"];
	        this.Ports = source["Ports"];
	        this.Protocols = source["Protocols"];
	        this.RSTPEnable = source["RSTPEnable"];
	        this.RSTPStatus = source["RSTPStatus"];
	        this.Sflow = source["Sflow"];
	        this.Status = source["Status"];
	        this.STPEnable = source["STPEnable"];
	    }
	}
	export class Interface {
	    UUID: string;
	    AdminState?: string;
	    BFD: Record<string, string>;
	    BFDStatus: Record<string, string>;
	    CFMFault?: boolean;
	    CFMFaultStatus: string[];
	    CFMFlapCount?: number;
	    CFMHealth?: number;
	    CFMMpid?: number;
	    CFMRemoteMpids: number[];
	    CFMRemoteOpstate?: string;
	    Duplex?: string;
	    Error?: string;
	    ExternalIDs: Record<string, string>;
	    Ifindex?: number;
	    IngressPolicingBurst: number;
	    IngressPolicingKpktsBurst: number;
	    IngressPolicingKpktsRate: number;
	    IngressPolicingRate: number;
	    LACPCurrent?: boolean;
	    LinkResets?: number;
	    LinkSpeed?: number;
	    LinkState?: string;
	    LLDP: Record<string, string>;
	    MAC?: string;
	    MACInUse?: string;
	    MTU?: number;
	    MTURequest?: number;
	    Name: string;
	    Ofport?: number;
	    OfportRequest?: number;
	    Options: Record<string, string>;
	    OtherConfig: Record<string, string>;
	    Statistics: Record<string, number>;
	    Status: Record<string, string>;
	    Type: string;
	
	    static createFrom(source: any = {}) {
	        return new Interface(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UUID = source["UUID"];
	        this.AdminState = source["AdminState"];
	        this.BFD = source["BFD"];
	        this.BFDStatus = source["BFDStatus"];
	        this.CFMFault = source["CFMFault"];
	        this.CFMFaultStatus = source["CFMFaultStatus"];
	        this.CFMFlapCount = source["CFMFlapCount"];
	        this.CFMHealth = source["CFMHealth"];
	        this.CFMMpid = source["CFMMpid"];
	        this.CFMRemoteMpids = source["CFMRemoteMpids"];
	        this.CFMRemoteOpstate = source["CFMRemoteOpstate"];
	        this.Duplex = source["Duplex"];
	        this.Error = source["Error"];
	        this.ExternalIDs = source["ExternalIDs"];
	        this.Ifindex = source["Ifindex"];
	        this.IngressPolicingBurst = source["IngressPolicingBurst"];
	        this.IngressPolicingKpktsBurst = source["IngressPolicingKpktsBurst"];
	        this.IngressPolicingKpktsRate = source["IngressPolicingKpktsRate"];
	        this.IngressPolicingRate = source["IngressPolicingRate"];
	        this.LACPCurrent = source["LACPCurrent"];
	        this.LinkResets = source["LinkResets"];
	        this.LinkSpeed = source["LinkSpeed"];
	        this.LinkState = source["LinkState"];
	        this.LLDP = source["LLDP"];
	        this.MAC = source["MAC"];
	        this.MACInUse = source["MACInUse"];
	        this.MTU = source["MTU"];
	        this.MTURequest = source["MTURequest"];
	        this.Name = source["Name"];
	        this.Ofport = source["Ofport"];
	        this.OfportRequest = source["OfportRequest"];
	        this.Options = source["Options"];
	        this.OtherConfig = source["OtherConfig"];
	        this.Statistics = source["Statistics"];
	        this.Status = source["Status"];
	        this.Type = source["Type"];
	    }
	}
	export class OpenvSwitch {
	    UUID: string;
	    Bridges: string[];
	    CurCfg: number;
	    DatapathTypes: string[];
	    Datapaths: Record<string, string>;
	    DbVersion?: string;
	    DpdkInitialized: boolean;
	    DpdkVersion?: string;
	    ExternalIDs: Record<string, string>;
	    IfaceTypes: string[];
	    ManagerOptions: string[];
	    NextCfg: number;
	    OtherConfig: Record<string, string>;
	    OVSVersion?: string;
	    SSL?: string;
	    Statistics: Record<string, string>;
	    SystemType?: string;
	    SystemVersion?: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenvSwitch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UUID = source["UUID"];
	        this.Bridges = source["Bridges"];
	        this.CurCfg = source["CurCfg"];
	        this.DatapathTypes = source["DatapathTypes"];
	        this.Datapaths = source["Datapaths"];
	        this.DbVersion = source["DbVersion"];
	        this.DpdkInitialized = source["DpdkInitialized"];
	        this.DpdkVersion = source["DpdkVersion"];
	        this.ExternalIDs = source["ExternalIDs"];
	        this.IfaceTypes = source["IfaceTypes"];
	        this.ManagerOptions = source["ManagerOptions"];
	        this.NextCfg = source["NextCfg"];
	        this.OtherConfig = source["OtherConfig"];
	        this.OVSVersion = source["OVSVersion"];
	        this.SSL = source["SSL"];
	        this.Statistics = source["Statistics"];
	        this.SystemType = source["SystemType"];
	        this.SystemVersion = source["SystemVersion"];
	    }
	}
	export class Port {
	    UUID: string;
	    BondActiveSlave?: string;
	    BondDowndelay: number;
	    BondFakeIface: boolean;
	    BondMode?: string;
	    BondUpdelay: number;
	    CVLANs: number[];
	    ExternalIDs: Record<string, string>;
	    FakeBridge: boolean;
	    Interfaces: string[];
	    LACP?: string;
	    MAC?: string;
	    Name: string;
	    OtherConfig: Record<string, string>;
	    Protected: boolean;
	    QOS?: string;
	    RSTPStatistics: Record<string, number>;
	    RSTPStatus: Record<string, string>;
	    Statistics: Record<string, number>;
	    Status: Record<string, string>;
	    Tag?: number;
	    Trunks: number[];
	    VLANMode?: string;
	
	    static createFrom(source: any = {}) {
	        return new Port(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UUID = source["UUID"];
	        this.BondActiveSlave = source["BondActiveSlave"];
	        this.BondDowndelay = source["BondDowndelay"];
	        this.BondFakeIface = source["BondFakeIface"];
	        this.BondMode = source["BondMode"];
	        this.BondUpdelay = source["BondUpdelay"];
	        this.CVLANs = source["CVLANs"];
	        this.ExternalIDs = source["ExternalIDs"];
	        this.FakeBridge = source["FakeBridge"];
	        this.Interfaces = source["Interfaces"];
	        this.LACP = source["LACP"];
	        this.MAC = source["MAC"];
	        this.Name = source["Name"];
	        this.OtherConfig = source["OtherConfig"];
	        this.Protected = source["Protected"];
	        this.QOS = source["QOS"];
	        this.RSTPStatistics = source["RSTPStatistics"];
	        this.RSTPStatus = source["RSTPStatus"];
	        this.Statistics = source["Statistics"];
	        this.Status = source["Status"];
	        this.Tag = source["Tag"];
	        this.Trunks = source["Trunks"];
	        this.VLANMode = source["VLANMode"];
	    }
	}

}

