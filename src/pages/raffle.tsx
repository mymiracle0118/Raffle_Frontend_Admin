import { useState, useEffect, useMemo } from 'react';
import { useWallet } from "@solana/wallet-adapter-react";
import {Connection,Keypair,LAMPORTS_PER_SOL,PublicKey,Transaction,ConfirmOptions,SystemProgram,clusterApiUrl,SYSVAR_CLOCK_PUBKEY} from '@solana/web3.js'
import {MintLayout,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID,Token} from "@solana/spl-token";
import useNotify from './notify'
import * as anchor from "@project-serum/anchor";

let wallet : any
// let conn = new Connection("https://solana-api.projectserum.com")
let conn = new Connection(clusterApiUrl("mainnet-beta"))
// let conn = new Connection("https://long-cool-sunset.solana-mainnet.quiknode.pro/f912ad4ca9a6184b879cda5cfed07bcbfa19950b/")
let notify: any

const programId = new PublicKey('rafrZNbxGdfFUBzddkzgtcHLqijmjarEihYcUuCuByV')
const idl = require('./raffle.json')
const confirmOption : ConfirmOptions = {commitment : 'finalized',preflightCommitment : 'finalized',skipPreflight : false}

const RAFFLE_SIZE = 8+32+50+200+100+100+1+8+4+4+8+8+32+32+1+100;
// const receiver = new PublicKey("devAa6UvUMX9G2Q5sSLLkMYYunAdarCPiqAtAeZcyVR");

export default function Raffle(){
	wallet = useWallet()
	notify = useNotify()

	const [raffleToken, setRaffleToken] = useState("7VEyj9ooKPLaxd4rxwRWB4J5Yo1upymWwNs7RL78i8Nj") 
	const [newRaffleSystem, setNewRaffleSystem] = useState("")
	const [curRaffleSystem, setCurRaffleSystem] = useState("3hBYENQPgwPEqZMj1WMVhbf476gHojCHoC2eqPi7svQv")
	const [raffleSystemData, setRaffleSystemData] = useState<any>(null)
	const [newAuthority, setNewAuthority] = useState("")

	const [redeemAmount, setRedeemAmount] = useState("")

	const [roomName, setRoomName] = useState("")
	const [logo, setLogo] = useState("")
	const [discord, setDiscord] = useState("")
	const [twitter, setTwitter] = useState("")
	const [ticketValue, setTicketValue] = useState("1")
	const [spotNum, setSpotNum] = useState("1")
	const [maxTicketNum, setMaxTicketNum] = useState("100")
	const [maxTicketPerUser, setMaxTicketPerUser] = useState("10")
	const [newRaffle, setNewRaffle] = useState('')
	const [curRaffle, setCurRaffle] = useState('')
	const [allRaffles, setAllRaffles] = useState<any[]>([])
	const [raffleDetail, setRaffleDetail] = useState<any>(null)
	const [newNft, setNewNft] = useState("")
	const [nftAccount, setNftAccount] = useState("");
	const [period, setPeriod] = useState("")
	const [winnerIndex, setWinnerIndex] = useState(0);
	const [receiver, setReciver] = useState("");
	const [raffleSystemAddr, setRaffleSystemAddr] = useState("");
	const [pauseflag, setPauseFlag] = useState(0);
	
	const [program] = useMemo(()=>{
		const provider = new anchor.Provider(conn, wallet as any, confirmOption)
		const program = new anchor.Program(idl, programId, provider)
		return [program]
	}, [])

	useEffect(()=>{
		getAllRaffles()
		getRaffleSystemData()
	},[curRaffleSystem])
	useEffect(()=>{getRaffleDetail()},[curRaffle])

	const createAssociatedTokenAccountInstruction = (
	  associatedTokenAddress: anchor.web3.PublicKey,
	  payer: anchor.web3.PublicKey,
	  walletAddress: anchor.web3.PublicKey,
	  splTokenMintAddress: anchor.web3.PublicKey
	  ) => {
	  const keys = [
	    { pubkey: payer, isSigner: true, isWritable: true },
	    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
	    { pubkey: walletAddress, isSigner: false, isWritable: false },
	    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
	    {
	      pubkey: anchor.web3.SystemProgram.programId,
	      isSigner: false,
	      isWritable: false,
	    },
	    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
	    {
	      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
	      isSigner: false,
	      isWritable: false,
	    },
	  ];
	  return new anchor.web3.TransactionInstruction({
	    keys,
	    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
	    data: Buffer.from([]),
	  });
	}

	async function getDecimalsOfToken(mint : PublicKey){
		let resp = await conn.getAccountInfo(mint)
		let accountData = MintLayout.decode(Buffer.from(resp!.data))
		return accountData.decimals
	}

	const getTokenWallet = async (owner: PublicKey,mint: PublicKey) => {
	  return (
	    await PublicKey.findProgramAddress(
	      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
	      ASSOCIATED_TOKEN_PROGRAM_ID
	    )
	  )[0];
	}

	const getRaffleSystemData = async() => {
		try{
			let data = await program.account.raffleSystem.fetch(new PublicKey(curRaffleSystem))
			let decimals = await getDecimalsOfToken(data.tokenMint)
			let resp : any = ((await conn.getTokenAccountBalance(data.tokenAccount)).value as any).uiAmount
			setRaffleSystemData({...data, decimals : decimals, tokenAmount : resp})
		}catch(err){
			setRaffleSystemData(null)
		}
	}

	const getAllRaffles = async() => {
		let raffles : any[] = []
		let resp = await conn.getProgramAccounts(programId,{
			commitment : "max",
			dataSlice : {
				length : 0, offset : 0,
			},
			filters : [
				{dataSize : RAFFLE_SIZE},
				{memcmp : {bytes : curRaffleSystem, offset : 8}}
			]
		})
		for(let item of resp){
			let raffleData = await program.account.raffle.fetch(item.pubkey)
			raffles.push({...raffleData, address : item.pubkey})
		}
		setAllRaffles(raffles)
	}

	const getRaffleDetail = async() => {
		if(curRaffle == '') return
		try{
			let raffleAddress = new PublicKey(curRaffle)
			let raffleData = await program.account.raffle.fetch(raffleAddress)
			let spotStore = await program.account.spotStore.fetch(raffleData.spotsAccount)
			let l = await program.account.ledger.fetch(raffleData.ledgerAccount)
			// for(let item of l.users as any[]){
			// 	console.log(item.toBase58())
			// }

			setRaffleDetail({...raffleData, spotStore : spotStore.spots})
		}catch(err){
			console.log(err)
			setRaffleDetail(null)
		}
	}

	const createRaffleSystem = async() => {
		try{
			let transaction = new Transaction()
			const rand = Keypair.generate().publicKey;
			const [raffleSystem, bump] = await PublicKey.findProgramAddress([rand.toBuffer()], programId)
			const raffleMint = new PublicKey(raffleToken)
			const manager = new PublicKey(receiver);
			const raffleTokenAccount = await getTokenWallet(raffleSystem, raffleMint)
			transaction.add(createAssociatedTokenAccountInstruction(raffleTokenAccount,wallet.publicKey, raffleSystem, raffleMint))
			transaction.add(program.instruction.initRaffleSystem(
				new anchor.BN(bump),
				{
					accounts:{
						owner : wallet.publicKey,
						manager : manager,
						raffleSystem : raffleSystem,
						rand : rand,
						tokenMint : raffleMint,
						tokenAccount : raffleTokenAccount,
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction, [])
			notify("success", "Success!")
			setRaffleSystemAddr(raffleSystem.toBase58());
			// console.log("raffle systemp", raffleSystem.toBase58());
			setNewRaffleSystem(raffleSystem.toBase58())
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const createRaffle = async() => {
		try{
			let transaction = new Transaction()
			let raffleSystem = new PublicKey(curRaffleSystem)
			let raffle = Keypair.generate()
			let ticket_value = Number(ticketValue) * (10**raffleSystemData.decimals)
			let spot_num = Number(spotNum)
			let max_ticket_num = Number(maxTicketNum)
			let max_ticket_per_user = Number(maxTicketPerUser)
			let ledger = Keypair.generate()
			let ledgerSize = 8+32+4+max_ticket_num*32
			let ledgerLamports = await conn.getMinimumBalanceForRentExemption(ledgerSize)
			transaction.add(SystemProgram.createAccount({
				fromPubkey : wallet.publicKey,
				lamports : ledgerLamports,
				newAccountPubkey : ledger.publicKey,
				programId : programId,
				space : ledgerSize 
			}))
			let spotStore = Keypair.generate()
			let spotStoreSize = 8+32+4+spot_num*37
			let spotStoreLamports = await conn.getMinimumBalanceForRentExemption(
				spotStoreSize)
			transaction.add(SystemProgram.createAccount({
				fromPubkey : wallet.publicKey,
				lamports : spotStoreLamports,
				newAccountPubkey : spotStore.publicKey,
				programId : programId,
				space : spotStoreSize
			}))
			transaction.add(program.instruction.initRaffle(
				roomName,
				logo,
				discord,
				twitter,
				new anchor.BN(ticket_value),
				new anchor.BN(spot_num),
				new anchor.BN(max_ticket_num),
				new anchor.BN(max_ticket_per_user),
				{
					accounts:{
						owner : wallet.publicKey,
						raffleSystem : raffleSystem,
						raffle : raffle.publicKey,
						ledger : ledger.publicKey,
						spotStore : spotStore.publicKey,
						systemProgram : SystemProgram.programId
					}
				}
			))
			await sendTransaction(transaction, [raffle, ledger, spotStore])
			notify('success', 'Success!')
			setNewRaffle(raffle.publicKey.toBase58())
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const setSpot = async(index : number) => {
		try{
			let transaction = new Transaction()
			let raffleSystem = new PublicKey(curRaffleSystem)
			let raffle = new PublicKey(curRaffle)
			let nft = new PublicKey(newNft)
			// let nftFrom = await getTokenWallet(wallet.publicKey, nft)
			// let nftFrom = new PublicKey("Atjy7H9etQC5h1M8w7yqEsspRrRUAfXV9oqsbRXfzdxD")
			// console.log("nft account", nftFrom.toBase58(), wallet.publicKey.toBase58())
			let nft_account = new PublicKey(nftAccount);
			// let nftFrom = await getTokenWallet(wallet.publicKey, nft)
			// let nftFrom = new PublicKey("Atjy7H9etQC5h1M8w7yqEsspRrRUAfXV9oqsbRXfzdxD")
			// console.log("nft account", nftFrom.toBase58(), wallet.publicKey.toBase58())
			let nftTo = await getTokenWallet(raffleSystem, nft)
			if((await conn.getAccountInfo(nftTo))==null){
				transaction.add(createAssociatedTokenAccountInstruction(nftTo,wallet.publicKey,raffleSystem,nft))
			}

			transaction.add(program.instruction.putSpot(new anchor.BN(index),{ accounts : {
				owner : wallet.publicKey,
				raffleSystem : raffleSystem,
				raffle : raffle,
				spotStore : raffleDetail.spotsAccount,
				nft : nft,
				nftFrom : nft_account,
				nftTo : nftTo,
				tokenProgram : TOKEN_PROGRAM_ID
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}	

	const redeemSpot = async(index : number, nft : PublicKey) => {
		try{
			let transaction = new Transaction()
			let raffleSystem = new PublicKey(curRaffleSystem)
			let raffle = new PublicKey(curRaffle)
			let nftTo = await getTokenWallet(wallet.publicKey, nft)
			let nftFrom = await getTokenWallet(raffleSystem, nft)
			if((await conn.getAccountInfo(nftTo))==null){
				transaction.add(createAssociatedTokenAccountInstruction(nftTo,wallet.publicKey,wallet.publicKey,nft))
			}
			transaction.add(program.instruction.redeemSpot(new anchor.BN(index),{ accounts : {
				owner : wallet.publicKey,
				raffleSystem : raffleSystem,
				raffle : raffle,
				spotStore : raffleDetail.spotsAccount,
				nft : nft,
				nftFrom : nftFrom,
				nftTo : nftTo,
				tokenProgram : TOKEN_PROGRAM_ID
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const startRaffle = async() => {
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.startRaffle(new anchor.BN(Number(period)),{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem),
				raffle : new PublicKey(curRaffle),
				clock : SYSVAR_CLOCK_PUBKEY
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const endRaffle = async() => {
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.endRaffle({ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem),
				raffle : new PublicKey(curRaffle),
				spotStore : raffleDetail.spotsAccount,
				ledger : raffleDetail.ledgerAccount,
				clock : SYSVAR_CLOCK_PUBKEY
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const endState = async() => {
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.endState(new anchor.BN(winnerIndex),
			{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem),
				raffle : new PublicKey(curRaffle),
				spotStore : raffleDetail.spotsAccount,
				ledger : raffleDetail.ledgerAccount
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const redeemToken = async() => {
		try{
			let raffleSystem = new PublicKey(curRaffleSystem)
			let tokenTo = await getTokenWallet(wallet.publicKey, raffleSystemData.tokenMint)
			let transaction = new Transaction()
			if((await conn.getAccountInfo(tokenTo))==null){
				transaction.add(createAssociatedTokenAccountInstruction(tokenTo,wallet.publicKey,wallet.publicKey,raffleSystemData.tokenMint))
			}
			transaction.add(program.instruction.redeemToken(
				new anchor.BN(Number(redeemAmount) * (10**raffleSystemData.decimals)),{
				accounts : {
					owner : wallet.publicKey,
					raffleSystem : raffleSystem,
					tokenFrom : raffleSystemData.tokenAccount,
					tokenTo : tokenTo,
					tokenProgram : TOKEN_PROGRAM_ID
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const showRaffle = async(isShow : boolean) => {
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.showRaffle(isShow,{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem),
				raffle : new PublicKey(curRaffle)
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}		
	}

	const transferAuthority = async() => {
		try{
			let transaction = new Transaction()
			let newAuth = new PublicKey(newAuthority)
			transaction.add(program.instruction.transferAuthority(newAuth,{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem)
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}	
	}

	const setManager = async() => {
		try{
			let transaction = new Transaction()
			let newAuth = new PublicKey(newAuthority)
			transaction.add(program.instruction.setManager(newAuth,{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem)
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const setPause = async() => {
		let flag = false;
		if(pauseflag == 0) {
			flag = false;
		} else {
			flag = true;
		}
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.setPause(flag,{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem)
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}

	const claim = async() => {
		try{
			let transaction = new Transaction()
			transaction.add(program.instruction.claim(new anchor.BN(1000000000),{ accounts:{
				owner : wallet.publicKey,
				raffleSystem : new PublicKey(curRaffleSystem),
				raffleSystemAddress : new PublicKey(curRaffleSystem)
			}}))
			await sendTransaction(transaction,[])
			notify('success', 'Success!')
		}catch(err){
			console.log(err)
			notify('error', 'Failed Transaction')
		}
	}
	
	async function sendTransaction(transaction : Transaction, signers : Keypair[]) {
		transaction.feePayer = wallet.publicKey
		transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
		await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
		if(signers.length !== 0) await transaction.partialSign(...signers)
		const signedTransaction = await wallet.signTransaction(transaction);
		let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
		await conn.confirmTransaction(hash);
		return hash
	}

	return <div className="container-fluid mt-4 row">
		<div className="col-lg-6">
			<div className="input-group mb-3">
				<input type="text" className="form-control" onChange={(event)=>{setReciver(event.target.value)}} value={receiver}/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await createRaffleSystem()
				}}>CREATE</button>
				<h5>{raffleSystemAddr}</h5>
		    </div>
			<div className="input-group mb-3">
				<input type="text" className="form-control" onChange={(event)=>{setPauseFlag(parseInt(event.target.value))}} value={pauseflag}/>
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await setPause()
				}}>Set Pause</button>
		    </div>
			<div className="row container-fluid mb-3">
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await claim()
				}}>Claim</button>
		    </div>
			<div className="input-group mb-3">
				<input name="newAuthority"  type="text" className="form-control" onChange={(event)=>{setWinnerIndex(parseInt(event.target.value))}} value={winnerIndex}/>
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await endState()
				}}>Set Winner</button>
			</div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Raffle System</span>
		        <input name="curRaffleSystem"  type="text" className="form-control" value={curRaffleSystem} readOnly/>
		    </div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Current Owner</span>
		        {raffleSystemData && <input name="curRaffleSystem"  type="text" value={raffleSystemData.owner.toBase58()} className="form-control" readOnly/>}
		    </div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Manager</span>
		        {raffleSystemData && <input name="curRaffleSystem"  type="text" value={raffleSystemData.manager.toBase58()} className="form-control" readOnly/>}
		    </div>
			<div className="input-group mb-3">
				<input name="newAuthority"  type="text" className="form-control" onChange={(event)=>{setNewAuthority(event.target.value)}} value={newAuthority}/>
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await transferAuthority()
					await getRaffleSystemData()
				}}>Transfer Ownership</button>
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await setManager()
				}}>Set Manager</button>
			</div>
			{
				raffleSystemData &&
				<h5>There are {raffleSystemData.tokenAmount} tokens</h5>
			}
			<div className="input-group mb-3">
				<span className="input-group-text">TOKEN</span>
				<input name="redeemAmount"  type="text" className="form-control" onChange={(event)=>{setRedeemAmount(event.target.value)}} value={redeemAmount}/>
				<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
					await redeemToken()
					await getRaffleSystemData()
				}}>Claim Token</button>
			</div>
			<hr/>
		    <div className="input-group mb-3">
		        <span className="input-group-text">Room Name</span>
		        <input name="roomName"  type="text" className="form-control" onChange={(event)=>{setRoomName(event.target.value)}} value={roomName}/>
		    </div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Logo URL</span>
		        <input name="logo"  type="text" className="form-control" onChange={(event)=>{setLogo(event.target.value)}} value={logo}/>
		    </div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Discord</span>
		        <input name="discord"  type="text" className="form-control" onChange={(event)=>{setDiscord(event.target.value)}} value={discord}/>
		    </div>
			<div className="input-group mb-3">
		        <span className="input-group-text">Twitter</span>
		        <input name="twitter"  type="text" className="form-control" onChange={(event)=>{setTwitter(event.target.value)}} value={twitter}/>
		    </div>
		    <div className="input-group mb-3">
		        <span className="input-group-text">Ticket Value</span>
		        <input name="ticketValue"  type="text" className="form-control" onChange={(event)=>{setTicketValue(event.target.value)}} value={ticketValue}/>
		    </div>
		    <div className="input-group mb-3">
		        <span className="input-group-text">Spot Num</span>
		        <input name="spotNum"  type="text" className="form-control" onChange={(event)=>{setSpotNum(event.target.value)}} value={spotNum}/>
		    </div>
		    <div className="input-group mb-3">
		        <span className="input-group-text">Max Ticket Num</span>
		        <input name="maxTicketNum"  type="text" className="form-control" onChange={(event)=>{setMaxTicketNum(event.target.value)}} value={maxTicketNum}/>
		    </div>
		    <div className="input-group mb-3">
		        <span className="input-group-text">Wallet Limit</span>
		        <input name="maxTicketPerUser"  type="text" className="form-control" onChange={(event)=>{setMaxTicketPerUser(event.target.value)}} value={maxTicketPerUser}/>
		    </div>
		    <div className="row container-fluid mb-3">
		    	<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
					await createRaffle()
					await getAllRaffles()
				}}>CREATE NEW RAFFLE</button>
		    </div>			
		    <h5>{newRaffle}</h5>
		    <hr/>
		    <h4>RAFFLES</h4>
		    <table className="table">
		    	<thead><tr><th>No</th><th>Name</th><th>Status</th><th></th></tr></thead>
		    	<tbody>
		    	{
		    		allRaffles.map((item,idx)=>{
		    			return <tr key={idx} onClick={()=>{
		    				setCurRaffle(item.address.toBase58())
		    			}}>
		    				<td>{idx+1}</td>
		    				<td>{item.roomName}</td>
		    				<td>{item.status===0 ? "not started" : item.status===1 ? "live" : "ended"}</td>
							<td>{item.isShow ? "Shown" : "Hidden"}</td>
						</tr>
		    		})
		    	}
		    	</tbody>
		    </table>
		</div>
		<div className="col-lg-6">
			<div className="input-group mb-3">
		        <span className="input-group-text">RAFFLE</span>
		        <input name="curRaffle"  type="text" className="form-control" onChange={(event)=>{setCurRaffle(event.target.value)}} value={curRaffle}/>
		    </div>
		    {
		    	raffleDetail!=null &&
		    	<>
					<div className="row container-fluid mb-3">
						<button type="button" className="btn btn-primary" disabled={!(wallet && wallet.connected)} onClick={async ()=>{
							await showRaffle(!raffleDetail.isShow)
						}}>{raffleDetail.isShow ? "Hide Raffle" : "Show Raffle"}</button>
					</div>
			    	<p>{"Name : "+raffleDetail.roomName}</p>
					<p>{"Logo URL : "+raffleDetail.logo}</p>
					<p>{"Discord : "+raffleDetail.discord}</p>
					<p>{"Twitter : "+raffleDetail.twitter}</p>
				    <p>{"Ticket Value : "+raffleDetail.ticketValue.toNumber() / (10**raffleSystemData.decimals)}</p>
				    <p>{"Spot Num : "+raffleDetail.spotNum}</p>
				    <p>{"Max Ticket Num : "+raffleDetail.maxTicketNum}</p>
					<p>{"Wallet Limit : "+raffleDetail.maxTicketPerUser}</p>
				    {
				    	raffleDetail.status===0 ?
					    	<div className="input-group mb-3">
						        <span className="input-group-text">Period</span>
						        <input name="period"  type="text" className="form-control" onChange={(event)=>{setPeriod(event.target.value)}} value={period}/>
						        <button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
						        	await startRaffle()
						        	await getRaffleDetail()
						        }}>START RAFFLE</button>
					    	</div>
					    :
					    	<>
					    		<p>{"Start Time : "+(new Date(raffleDetail.startTime.toNumber()*1000))}</p>
					    		<p>{"Period : "+raffleDetail.period.toNumber()+"s"}</p>
				    		</>
				    }
					{
						raffleDetail.status===1 &&
						<div>
							<button type="button" className="btn btn-danger" disabled={!(wallet && wallet.connected)} onClick={async()=>{
								await endRaffle()
								await getRaffleDetail()
							}}>End RAFFLE</button>
						</div>
					}
				    <p>Spots : </p>
				    {
				    	raffleDetail.status===0 &&
				    	<div className="input-group mb-3">
					        <span className="input-group-text">NEW NFT</span>
					        <input name="newNft"  type="text" className="form-control" onChange={(event)=>{setNewNft(event.target.value)}} value={newNft}/>
					    </div>
				    }
					{
				    	raffleDetail.status===0 &&
							<div className="input-group mb-3">
								<span className="input-group-text">NFT Account</span>
								<input name="newNft"  type="text" className="form-control" onChange={(event)=>{setNftAccount(event.target.value)}} value={nftAccount}/>
							</div>
					}
		    		<table className="table">
				    	<thead><tr><th>No</th><th>NFT ADDRESS</th><th></th></tr></thead>
				    	<tbody>
				    	{
				    		(raffleDetail.spotStore as any[]).map((item,idx)=>{

				    			if(item.nft.toBase58() === PublicKey.default.toBase58()){
				    				return <tr key={idx}>
				    					<td>{idx+1}</td>
				    					<td>NO NFT</td>
				    					<td>
				    					{
				    						raffleDetail.status===0 &&
				    						<button type="button" className="btn btn-success" style={{padding : "0", width : "100%"}} onClick={async()=>{
				    							await setSpot(idx)
				    							await getRaffleDetail()
				    						}}>Set</button>
				    					}
				    					</td>
				    				</tr>
				    			}else{
				    				return <tr key={idx}>
				    					<td>{idx+1}</td>
				    					<td>{item.nft.toBase58()}</td>
				    					<td>
				    					{
				    						raffleDetail.status===0 &&
				    						<button type="button" className="btn btn-success" style={{padding : "0", width : "100%"}} onClick={async()=>{
				    							await redeemSpot(idx, item.nft)
				    							await getRaffleDetail()
				    						}}>Redeem</button>
				    					}
				    					</td>
				    				</tr>
				    			}
				    		})
				    	}
				    	</tbody>
				    </table>
		    	</>
		    }
		    
		</div>
	</div>
	  
}