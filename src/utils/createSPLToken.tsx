import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, MintLayout, getMinimumBalanceForRentExemptMint, createInitializeMintInstruction, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, TransactionInstruction, clusterApiUrl, sendAndConfirmTransaction } from '@solana/web3.js';
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Dispatch, SetStateAction } from 'react';
import { PROGRAM_ID, DataV2, createCreateMetadataAccountV3Instruction, createMintInstruction  } from '@metaplex-foundation/mpl-token-metadata';
import { irysStorage, Metaplex, MetaplexFileTag, walletAdapterIdentity } from '@metaplex-foundation/js';



export async function createSPLToken(owner: PublicKey, wallet: WalletContextState, connection: Connection, quantity: number, decimals: number, isChecked: boolean, tokenName: string, symbol: string, metadataURL: string, description: string, file: Readonly<{
    buffer: Buffer;
    fileName: string;
    displayName: string;
    uniqueName: string;
    contentType: string | null;
    extension: string | null;
    tags: MetaplexFileTag[];
}> | undefined,
    metadataMethod: string,
    setIscreating: Dispatch<SetStateAction<boolean>>, setTokenAddresss: Dispatch<SetStateAction<string>>, setSignature: Dispatch<SetStateAction<string>>, setError: Dispatch<SetStateAction<string>>) {
    try {
        setIscreating(true)
        setTokenAddresss('')
        
        const metaplex = Metaplex.make(connection)
            .use(walletAdapterIdentity(wallet))
            .use(
                irysStorage({
                  address: "https://devnet.irys.xyz", //https://node1.irys.xyz
                }))

        const mint_rent = await getMinimumBalanceForRentExemptMint(connection)

        const mint_account = new Keypair();

        let InitMint: TransactionInstruction
        

        const [metadataPDA] = await PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                PROGRAM_ID.toBuffer(),
                mint_account.publicKey.toBuffer(),
            ], PROGRAM_ID
        );

        let URI: string = ''

        if (metadataMethod == 'url') {
            if (metadataURL != '') {
                URI = metadataURL
            }
            else {
                setIscreating(false)
                setError('Please provide a metadata URL!')
            }
        }

        else {
            if (file) {
                const ImageUri = await metaplex.storage().upload(file);

                if (ImageUri) {
                    const { uri } = await metaplex.nfts().uploadMetadata({
                        name: tokenName,
                        symbol: symbol,
                        description: description,
                        image: ImageUri,
                    })
                    if (uri) {
                        URI = uri
                    }
                }
            }
            else {
                setIscreating(false)
                setError('Please provide an image file!')
            }
        }

        if (URI != '') {

            const tokenMetadata: DataV2 = {
                name: tokenName,
                symbol: symbol,
                uri: URI,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null
            };

            const args = {
                data: tokenMetadata,
                isMutable: true,
            };

            const createMintAccountInstruction = await SystemProgram.createAccount({
                fromPubkey: owner,
                newAccountPubkey: mint_account.publicKey,
                space: MintLayout.span,
                lamports: mint_rent,
                programId: TOKEN_PROGRAM_ID,
            });

            console.log('createMintAccountInstruction',createMintAccountInstruction)

            

            if (isChecked) {
                InitMint = await createInitializeMintInstruction(
                    mint_account.publicKey,
                    decimals,
                    owner,
                    owner,
                    TOKEN_PROGRAM_ID
                );

            } else {
                InitMint = await createInitializeMintInstruction(
                    mint_account.publicKey,
                    decimals,
                    owner,
                    null,
                    TOKEN_PROGRAM_ID
                );

            };

            console.log('createMintAccountInstruction',createMintAccountInstruction)

            const associatedTokenAccount = await getAssociatedTokenAddress(
                mint_account.publicKey,
                owner
            );

            console.log('associatedTokenAccount',associatedTokenAccount)

            const createATAInstruction = await createAssociatedTokenAccountInstruction(
                owner,
                associatedTokenAccount,
                owner,
                mint_account.publicKey
            );

            console.log('createATAInstruction',createATAInstruction)

            const mintInstruction = await createMintToInstruction(
                mint_account.publicKey,
                associatedTokenAccount,
                owner,
                quantity * 10 ** decimals
            );

            console.log('mintInstruction',mintInstruction)


            const MetadataInstruction = createCreateMetadataAccountV3Instruction(
                {
                    metadata: metadataPDA,
                    mint: mint_account.publicKey,
                    mintAuthority: owner,
                    payer: owner,
                    updateAuthority: owner,
                },
                {
                    createMetadataAccountArgsV3: {
                      data: tokenMetadata,
                      isMutable: false,
                      collectionDetails: null,
                    },
                }
            );

            console.log('MetadataInstruction',MetadataInstruction)

            const createAccountTransaction = new Transaction().add(createMintAccountInstruction, InitMint, createATAInstruction, mintInstruction, MetadataInstruction);

            const createAccountSignature = await wallet.sendTransaction(createAccountTransaction, connection, { signers: [mint_account] });

            const createAccountconfirmed = await connection.confirmTransaction(createAccountSignature, 'confirmed');

            const signature = createAccountSignature.toString()


            if (createAccountconfirmed) {
                setIscreating(false);
                setTokenAddresss(mint_account.publicKey.toBase58());
                setSignature(signature)
            }
        }

    } catch (error) {
        setIscreating(false);
        const err = (error as any)?.message;
        setError(err)
    }

}