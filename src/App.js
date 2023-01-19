import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Contract, providers } from 'ethers';
import Web3Modal from 'web3modal';

import {
  ESCROW_FACTORY_CONTRACT_ADDRESS,
  ESCROW_FACTORY_ABI,
  ESCROW_ABI
} from "../constants";

function App() {
  const CHAIN_ID = 5;
  const NETWORK_NAME = "goerli";

  const [walletConnected, setWalletConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null)
  const web3ModalRef = useRef();
  const [loading, setLoading] = useState(false);
  const [buyerAddress, setBuyerAddress] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [escrowAmount, setEscrowAmount] = useState(0);
  const [escrowTokenAddress, setEscrowTokenAddress] = useState('');
  const [totalNumOfEscrow, setTotalNumOfEscrow] = (0);
  const [escrows, setEscrows] = useState([]);
  const [buyerPaymentAmount, setBuyerPaymentAmount] = useState(0);

  // Helper function to fetch a Provider instance from Metamask
  const getProvider = useCallback(async () => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);
    const getSigner = web3Provider.getSigner();

    const { chainId } = await web3Provider.getNetwork();

    setAccount(await getSigner.getAddress());
    setWalletConnected(true)


    if (chainId !== CHAIN_ID) {
    window.alert(`Please switch to the ${NETWORK_NAME} network!`);
        throw new Error(`Please switch to the ${NETWORK_NAME} network`);
    }
    setProvider(web3Provider);
  }, []);

  // Helper function to fetch a Signer instance from Metamask
  const getSigner = useCallback(async () => {
    const web3Modal = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(web3Modal);

    const { chainId } = await web3Provider.getNetwork();


    if (chainId !== CHAIN_ID) {
    window.alert(`Please switch to the ${NETWORK_NAME} network!`);
        throw new Error(`Please switch to the ${NETWORK_NAME} network`);
    }
    
    const signer = web3Provider.getSigner();
    return signer;  
  }, []);

    // Helper function to return a Escrow Factory Contract instance
    // given a Provider/Signer
    const getEscrowFactoryInstance = useCallback((providerOrSigner) => {
      return new Contract(
        ESCROW_FACTORY_CONTRACT_ADDRESS,
        ESCROW_FACTORY_ABI,
        providerOrSigner
      );
    },[]);

    // Helper function to return an Escrow Contract instance // receiving the contract address as argument
    // given a Provider/Signer
    const getEscrowInstance = useCallback((providerOrSigner, escrowContractAddress) => {
      return new Contract(
        escrowContractAddress,
        ESCROW_ABI,
        providerOrSigner
      )
    },[]);


    // This function sets the to total number of escrow created by Factory contract to state.
    const getTotalNumOfEscrows = useCallback(async () => {
      try {
          const contract = getEscrowFactoryInstance(provider);
          const totalNumOfEscrow = await contract.getNumberofescrowMade();
          setTotalNumOfEscrow(totalNumOfEscrow.toString());
      } catch (error) {
          console.error(error);
      }
    },[getEscrowFactoryInstance, provider]);

    // This function gets all the escrows and their details
    // Using the factory contract, it first returns an array that contains addresses of all the escrows created
    // Then it loops through this array and gets an instance of the escrow contract using each address in the array
    // All the escrows and the details are set to state called escrows.
    // To use it, map the escrows state and use the content of the array
    const getAllEscrows = useCallback(async () => {
      try {
          const EscrowFactroryContract = getEscrowFactoryInstance(provider);
          const allEscrows = await EscrowFactroryContract.getescrowClone();

          const escrows = [];

          if(allEscrows.length > 0){
                allEscrows.map(async (escrow) => {
                  const escrowContract = getEscrowInstance(provider, escrow);
                  const price = await escrowContract.price();
                  const fee = await escrowContract.fee();
                  const status = await escrowContract.status();

                  const escrowDetails = {
                    address: escrow,
                    price: price,
                    fee: fee,
                    status: status
                  };

                  escrows.push(escrowDetails)
              });
          }

          setEscrows(escrows);

      } catch (error) {
          console.error(error);
      }
    }, [getEscrowFactoryInstance, getEscrowInstance, provider]);


    // Function to connect wallet using metamask
    const connectWallet = useCallback(async () => {
      try {
        web3ModalRef.current = new Web3Modal({
          network: NETWORK_NAME,
          providerOptions: {},
          disableInjectedProvider: false,
        });

        await getProvider();
      } catch (error) {
        console.error(error);
      }
    },[getProvider]);

    const createEscrow = async (e) => {
      e.preventDefault();

      if(buyerAddress === "" || sellerAddress === "" || escrowAmount === 0 || escrowTokenAddress === ""){
          alert("All fields are required");
      } else {
          try {
              const signer = await getSigner();
              const factoryContract = getEscrowFactoryInstance(signer);
              const txn = await factoryContract.CreateNewEscrow(buyerAddress, sellerAddress, escrowAmount, escrowTokenAddress);
              setLoading(true);
              await txn.wait();
              await getNumVotingPolls();
              await getAllVotingPolls();
              setLoading(false);
              setBuyerAddress('');
              setSellerAddress('');
              setEscrowAmount(0);
              setEscrowTokenAddress('');
          } catch (error) {
              console.error(error);
              window.alert(error.data.message);
          }
      }
  }

  // This function is called when buy click the button to send payment
  const buyerSendPaymentHandler = async (e, escrowContractAddress) => {
    e.preventDefault();

    if(buyerPaymentAmount === 0) {
      alert("can't pay zero amount")
    } else {
      try {
        const signer = await getSigner();
        const escrowContract = getEscrowInstance(signer, escrowContractAddress);
        const txn = await escrowContract.BuyerSendPayment(+buyerPaymentAmount);

        setVoteLoading(true);
        await txn.wait();
      } catch (error) {
          console.error(error);
      }
    }
  }

  const buyerPaymentAmountChangeHandler = (e) => {
    setBuyerPaymentAmount(e.target.value);
  }

  // This function will be called inside an onChange attribute of the buyerAddress input field
  const buyerAddressChangeHandler = (e) => {
    setBuyerAddress(e.target.value);
  }

  // This function will be called inside an onChange attribute of the sellerAddress input field
  const sellerAddressChangeHandler = (e) => {
    setSellerAddress(e.target.value);
  }

  // This function will be called inside an onChange attribute of the escrowAmount input field
  const escrowAmountChangeHandler = (e) => {
    setEscrowAmount(+e.target.value);
  }

  // This function will be called inside an onChange attribute of the escrowTokenAddress input field
  const escrowTokenAddressChangeHandler = (e) => {
    setEscrowTokenAddress(+e.target.value);
  }

  // This use effect gets the all the escrows and total number of escrows created once page loads
  useEffect(() => {
    const fetchEscrows = async () => {
      if(account && provider){
        await getTotalNumOfEscrows();
        await getAllEscrows();
      }
    }

    fetchEscrows();
  }, [account, provider, getTotalNumOfEscrows, getAllEscrows]);

  // useEffect() is used here to trigger wallet connection once page loads
  useEffect(() => {
    if(!walletConnected) {
      connectWallet();
    }
  }, [walletConnected, connectWallet]);


  return (
    <div className="">
      
    </div>
  );
}

export default App;
